import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventType } from '@vnu/shared-types';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { AuditService } from '../../shared/audit/audit.service';
import { ProctoringGateway } from './proctoring.gateway';

export interface ScoreOverrideBody {
  part1?: number;
  part2?: number;
  part3?: number;
  total?: number;
  reason?: string;
  reviewedBy: string;
}

@Injectable()
export class ProctorScoreService {
  constructor(
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    private readonly auditService: AuditService,
    private readonly gateway: ProctoringGateway,
  ) {}

  async overrideSlotScore(slotId: string, body: ScoreOverrideBody) {
    const slot = await this.slotRepo.findOne({
      where: { id: slotId },
      relations: ['student'],
    });
    if (!slot) throw new NotFoundException('Không tìm thấy slot môn');
    if (slot.status !== 'completed') {
      throw new BadRequestException('Chỉ sửa điểm sau khi thí sinh đã nộp bài');
    }

    const prev = (slot.scoreResult ?? {}) as Record<string, unknown>;
    const partScores = {
      ...((prev.partScores as Record<string, number>) ?? {}),
    };
    if (body.part1 != null) partScores.part1 = body.part1;
    if (body.part2 != null) partScores.part2 = body.part2;
    if (body.part3 != null) partScores.part3 = body.part3;

    let total = body.total;
    if (total == null && (body.part1 != null || body.part2 != null || body.part3 != null)) {
      total =
        Math.round(
          ((partScores.part1 ?? 0) + (partScores.part2 ?? 0) + (partScores.part3 ?? 0)) * 100,
        ) / 100;
    }
    if (total == null && typeof prev.total === 'number') total = prev.total;

    const scoreResult: Record<string, unknown> = {
      ...prev,
      total,
      partScores,
      manualOverride: true,
      overrideAt: new Date().toISOString(),
      overrideBy: body.reviewedBy,
      overrideReason: body.reason ?? '',
    };

    slot.scoreResult = scoreResult;
    await this.slotRepo.save(slot);

    let session: StudentSession | null = null;
    if (slot.studentSessionId) {
      session = await this.sessionRepo.findOne({ where: { id: slot.studentSessionId } });
    } else if (slot.studentId) {
      session = await this.sessionRepo.findOne({
        where: {
          studentId: slot.studentId,
          examSessionId: slot.examSessionId,
          subjectCode: slot.subjectCode,
        },
      });
    }
    if (session) {
      session.scoreResult = scoreResult;
      await this.sessionRepo.save(session);
    }

    const sbd =
      session?.sbd ??
      (await this.sessionRepo.findOne({ where: { studentId: slot.studentId, examSessionId: slot.examSessionId } }))
        ?.sbd ??
      '';

    await this.auditService.log({
      eventType: AuditEventType.SCORE_OVERRIDE,
      examSessionId: slot.examSessionId,
      studentSessionId: session?.id,
      payload: {
        slotId,
        subjectCode: slot.subjectCode,
        sbd,
        total,
        partScores,
        reviewedBy: body.reviewedBy,
        reason: body.reason,
      },
    });

    await this.gateway.broadcastGrid(slot.examSessionId);
    this.gateway.emitScoreUpdate(slot.examSessionId, {
      slotId,
      sbd,
      subjectCode: slot.subjectCode,
      scoreTotal: total,
      partScores,
      manualOverride: true,
    });

    return { ok: true, scoreResult };
  }
}
