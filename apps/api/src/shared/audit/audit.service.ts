import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { AuditEventType } from '@vnu/shared-types';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: {
    eventType: AuditEventType;
    examSessionId?: string;
    studentSessionId?: string;
    payload?: Record<string, unknown>;
    ip?: string;
  }) {
    const entry = this.auditRepo.create({
      eventType: params.eventType,
      examSessionId: params.examSessionId,
      studentSessionId: params.studentSessionId,
      payload: params.payload ?? {},
      ip: params.ip,
    });
    return this.auditRepo.save(entry);
  }

  async findBySession(examSessionId: string, studentSessionId?: string) {
    const where: Record<string, string> = { examSessionId };
    if (studentSessionId) where.studentSessionId = studentSessionId;
    return this.auditRepo.find({ where, order: { createdAt: 'DESC' }, take: 500 });
  }
}
