import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

export type IdempotencyBeginResult =
  | { status: 'new' }
  | { status: 'replay'; response: unknown }
  | { status: 'processing' }
  | { status: 'mismatch' };

const TTL_SEC = 300;
const PREFIX = 'idem:';

@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private memory = new Map<string, { fingerprint: string; response?: unknown; processing: boolean; expires: number }>();

  constructor(private readonly configService: ConfigService) {
    try {
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST') || 'localhost',
        port: parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10),
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      this.redis.connect().catch(() => {
        this.redis?.disconnect();
        this.redis = null;
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  static fingerprint(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  async begin(key: string, fingerprint: string): Promise<IdempotencyBeginResult> {
    if (this.redis) {
      try {
        const fpKey = `${PREFIX}${key}:fp`;
        const resKey = `${PREFIX}${key}:res`;
        const lockKey = `${PREFIX}${key}:lock`;

        const existingFp = await this.redis.get(fpKey);
        if (existingFp && existingFp !== fingerprint) return { status: 'mismatch' };

        const cached = await this.redis.get(resKey);
        if (cached) {
          return { status: 'replay', response: JSON.parse(cached) };
        }

        const locked = await this.redis.set(lockKey, '1', 'EX', TTL_SEC, 'NX');
        if (!locked) return { status: 'processing' };

        if (!existingFp) await this.redis.set(fpKey, fingerprint, 'EX', TTL_SEC);
        return { status: 'new' };
      } catch {
        this.redis = null;
      }
    }

    const now = Date.now();
    const entry = this.memory.get(key);
    if (entry && entry.expires > now) {
      if (entry.fingerprint !== fingerprint) return { status: 'mismatch' };
      if (entry.response !== undefined) return { status: 'replay', response: entry.response };
      if (entry.processing) return { status: 'processing' };
    }
    this.memory.set(key, { fingerprint, processing: true, expires: now + TTL_SEC * 1000 });
    return { status: 'new' };
  }

  async complete(key: string, response: unknown): Promise<void> {
    if (this.redis) {
      try {
        const resKey = `${PREFIX}${key}:res`;
        const lockKey = `${PREFIX}${key}:lock`;
        await this.redis.set(resKey, JSON.stringify(response), 'EX', TTL_SEC);
        await this.redis.del(lockKey);
        return;
      } catch {
        this.redis = null;
      }
    }
    const entry = this.memory.get(key);
    if (entry) {
      entry.processing = false;
      entry.response = response;
    }
  }

  async fail(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`${PREFIX}${key}:lock`);
        return;
      } catch {
        this.redis = null;
      }
    }
    this.memory.delete(key);
  }
}
