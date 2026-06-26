import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AnonymizationMap } from '../../database/entities/anonymization-map.entity';
import { StudentSession } from '../../database/entities/student-session.entity';

@Injectable()
export class AnonymizationService {
  private salt = process.env.ANONYMIZATION_SALT || 'default-salt';

  constructor(
    @InjectRepository(AnonymizationMap)
    private readonly mapRepo: Repository<AnonymizationMap>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
  ) {}

  hashIdentity(studentId: string, examSessionId: string): string {
    return createHash('sha256')
      .update(`${studentId}:${examSessionId}:${this.salt}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
  }

  async generateForSession(examSessionId: string) {
    const sessions = await this.sessionRepo.find({
      where: { examSessionId },
      relations: ['student'],
    });

    const maps: AnonymizationMap[] = [];
    for (const s of sessions) {
      if (!s.studentId) continue;
      const existing = await this.mapRepo.findOne({
        where: { studentId: s.studentId, examSessionId },
      });
      if (existing) {
        maps.push(existing);
        continue;
      }

      const entry = this.mapRepo.create({
        studentId: s.studentId,
        examSessionId,
        hashCode: this.hashIdentity(s.studentId, examSessionId),
      });
      maps.push(await this.mapRepo.save(entry));
    }
    return maps.map((m) => ({ hashCode: m.hashCode, revealed: !!m.revealedAt }));
  }

  async reveal(examSessionId: string, authorizedBy: string) {
    const maps = await this.mapRepo.find({ where: { examSessionId } });
    const now = new Date();
    for (const m of maps) {
      m.revealedAt = now;
      await this.mapRepo.save(m);
    }
    return maps.map((m) => ({
      hashCode: m.hashCode,
      studentId: m.studentId,
      revealedAt: m.revealedAt,
      authorizedBy,
    }));
  }

  async listMasked(examSessionId: string) {
    const maps = await this.mapRepo.find({ where: { examSessionId } });
    return maps.map((m) => ({
      hashCode: m.hashCode,
      revealed: !!m.revealedAt,
      studentId: m.revealedAt ? m.studentId : undefined,
    }));
  }
}
