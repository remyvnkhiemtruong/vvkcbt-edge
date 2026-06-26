import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { AuditEventType } from '@vnu/shared-types';

export type AuditActorRole = 'student' | 'proctor' | 'system';

export interface EnrichedAuditLog {
  id: string;
  eventType: AuditEventType;
  detail: string;
  clientIp?: string;
  createdAt: Date;
  actor: string;
  actorRole: AuditActorRole;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
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

  async findEnrichedBySession(examSessionId: string): Promise<EnrichedAuditLog[]> {
    const logs = await this.findBySession(examSessionId);
    const sessionIds = [
      ...new Set(logs.map((l) => l.studentSessionId).filter((id): id is string => !!id)),
    ];
    const sessions =
      sessionIds.length > 0
        ? await this.sessionRepo.find({
            where: { id: In(sessionIds) },
            relations: ['student'],
          })
        : [];
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    return logs.map((l) => {
      const payload = l.payload ?? {};
      const session = l.studentSessionId ? sessionMap.get(l.studentSessionId) : undefined;
      const { actor, actorRole } = this.resolveActor(l.eventType, payload, session);
      return {
        id: l.id,
        eventType: l.eventType,
        detail: JSON.stringify(payload),
        clientIp: l.ip,
        createdAt: l.createdAt,
        actor,
        actorRole,
      };
    });
  }

  private resolveActor(
    eventType: AuditEventType,
    payload: Record<string, unknown>,
    session?: StudentSession,
  ): { actor: string; actorRole: AuditActorRole } {
    const sbd = String(payload.sbd ?? session?.sbd ?? '').trim();
    const fullName = session?.student?.fullName?.trim() ?? '';
    const examAccount = payload.examAccount != null ? String(payload.examAccount) : session?.examAccount ?? '';

    const studentLabel = () => {
      if (fullName && sbd) return `${fullName} · SBD ${sbd}`;
      if (fullName) return fullName;
      if (sbd) return `Thí sinh SBD ${sbd}`;
      if (examAccount) return `Tài khoản ${examAccount}`;
      return 'Thí sinh';
    };

    const proctorLabel = () => {
      const name = String(payload.performedBy ?? payload.reviewedBy ?? '').trim();
      return name ? `Giám thị ${name}` : 'Giám thị';
    };

    switch (eventType) {
      case AuditEventType.PROCTOR_ACTION:
      case AuditEventType.SCORE_OVERRIDE:
      case AuditEventType.APPEAL_REVIEWED:
        return { actor: proctorLabel(), actorRole: 'proctor' };
      case AuditEventType.LOGIN:
      case AuditEventType.CLICK:
      case AuditEventType.AUTOSAVE:
      case AuditEventType.SUBMIT:
      case AuditEventType.FOCUS_LOST:
      case AuditEventType.FOCUS_VIOLATION:
      case AuditEventType.FULLSCREEN_EXIT:
      case AuditEventType.HELP_REQUEST:
        return { actor: studentLabel(), actorRole: 'student' };
      case AuditEventType.APPEAL_CREATED:
        return { actor: studentLabel(), actorRole: 'student' };
      default:
        if (payload.performedBy || payload.reviewedBy) {
          return { actor: proctorLabel(), actorRole: 'proctor' };
        }
        if (sbd || fullName || examAccount) {
          return { actor: studentLabel(), actorRole: 'student' };
        }
        return { actor: 'Hệ thống', actorRole: 'system' };
    }
  }
}
