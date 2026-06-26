import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UnauthorizedException,
  NotFoundException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as fs from 'fs';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { MediaAsset } from '../database/entities/media-asset.entity';
import { StudentSession } from '../database/entities/student-session.entity';
import { StudentAuthGuard } from '../shared/guards/student-auth.guard';
import { isEdgeLightweight } from '../shared/config/edge-env';

const audioTokens = new Map<string, { assetId: string; sessionId: string; expires: number }>();

@Controller('infra')
export class InfraController {
  private audioKey = Buffer.from(
    (process.env.AUDIO_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef').slice(0, 32),
  );

  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const checks: Record<string, string> = {};
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      if (isEdgeLightweight()) {
        checks.redis = 'skipped (lightweight)';
      } else {
        const redis = new Redis({
          host: this.configService.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10),
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });
        await redis.ping();
        checks.redis = 'ok';
        redis.disconnect();
      }
    } catch {
      checks.redis = isEdgeLightweight() ? 'skipped (lightweight)' : 'error';
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    try {
      fs.accessSync(uploadDir, fs.constants.W_OK);
      checks.uploads = 'ok';
    } catch {
      checks.uploads = 'error';
    }

    const backupDir = process.env.BACKUP_DIR || './backups';
    try {
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.accessSync(backupDir, fs.constants.W_OK);
      checks.backups = 'ok';
    } catch {
      checks.backups = 'error';
    }

    try {
      const rows = await this.dataSource.query(
        `SELECT name FROM migrations ORDER BY id DESC LIMIT 1`,
      );
      checks.migration = rows?.[0]?.name ? `ok (${rows[0].name})` : 'ok (none)';
    } catch {
      checks.migration = 'error';
    }

    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });
      await browser.close();
      checks.puppeteer = 'ok';
      checks.pdfEngine = 'puppeteer';
    } catch {
      checks.puppeteer = 'skipped (excel-fallback)';
      checks.pdfEngine = 'ok (excel-fallback)';
    }

    const allOk = Object.entries(checks).every(([, v]) => {
      return v === 'ok' || String(v).startsWith('ok') || String(v).startsWith('skipped');
    });
    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      node: process.env.NODE_ROLE || 'master',
      checks,
    };
  }

  @Post('audio/:assetId/token')
  @UseGuards(StudentAuthGuard)
  async createAudioToken(@Param('assetId') assetId: string, @Req() req: Request) {
    const session = (req as Request & { studentSession: StudentSession }).studentSession;
    if (!session) throw new NotFoundException('Session not found');

    const maxPlays = session.examSession?.rules?.audio?.max_plays ?? 2;
    const audioMeta = (session.answers.audio_meta as { playCount?: number }) ?? {};
    if ((audioMeta.playCount ?? 0) >= maxPlays) {
      throw new UnauthorizedException('Max plays exceeded');
    }

    const token = randomBytes(16).toString('hex');
    audioTokens.set(token, {
      assetId,
      sessionId: session.id,
      expires: Date.now() + 300000,
    });

    return { token, expiresIn: 300 };
  }

  @Get('audio/stream/:token')
  async streamAudio(@Param('token') token: string, @Res() res: Response) {
    const entry = audioTokens.get(token);
    if (!entry || entry.expires < Date.now()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const asset = await this.mediaRepo.findOne({ where: { id: entry.assetId } });
    if (!asset) throw new NotFoundException('Audio not found');

    const session = await this.sessionRepo.findOne({ where: { id: entry.sessionId } });
    if (session) {
      const audioMeta = (session.answers.audio_meta as { playCount?: number }) ?? { playCount: 0 };
      audioMeta.playCount = (audioMeta.playCount ?? 0) + 1;
      session.answers = { ...session.answers, audio_meta: audioMeta };
      await this.sessionRepo.save(session);
    }

    let data: Buffer = fs.readFileSync(asset.path);
    if (asset.encrypted) {
      data = Buffer.from(this.decrypt(data));
    }

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(data);
  }

  encryptBuffer(buffer: Buffer): Buffer {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.audioKey, iv);
    return Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  }

  private decrypt(buffer: Buffer): Buffer {
    const iv = buffer.subarray(0, 16);
    const encrypted = buffer.subarray(16);
    const decipher = createDecipheriv('aes-256-cbc', this.audioKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
