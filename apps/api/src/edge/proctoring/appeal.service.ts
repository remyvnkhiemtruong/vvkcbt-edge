import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppealRequest, AppealStatus } from '../../database/entities/appeal-request.entity';
import { AuditService } from '../../shared/audit/audit.service';
import { AuditEventType } from '@vnu/shared-types';

@Injectable()
export class AppealService {
  constructor(
    @InjectRepository(AppealRequest)
    private readonly appealRepo: Repository<AppealRequest>,
    private readonly audit: AuditService,
  ) {}

  list(examSessionId: string) {
    return this.appealRepo.find({
      where: { examSessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: {
    examSessionId: string;
    sbd: string;
    subjectCode: string;
    questionId?: string;
    reason: string;
  }) {
    const row = await this.appealRepo.save(
      this.appealRepo.create({
        examSessionId: dto.examSessionId,
        sbd: dto.sbd.trim(),
        subjectCode: dto.subjectCode.trim(),
        questionId: dto.questionId?.trim() || null,
        reason: dto.reason.trim(),
        status: 'pending',
      }),
    );
    await this.audit.log({
      examSessionId: dto.examSessionId,
      eventType: AuditEventType.APPEAL_CREATED,
      payload: { appealId: row.id, sbd: row.sbd, subjectCode: row.subjectCode },
    });
    return row;
  }

  async review(
    id: string,
    dto: {
      status: AppealStatus;
      reviewedBy: string;
      reviewNote?: string;
      scoreBefore?: number;
      scoreAfter?: number;
    },
  ) {
    const row = await this.appealRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy đơn phúc khảo');
    await this.appealRepo.update(id, {
      status: dto.status,
      reviewedBy: dto.reviewedBy,
      reviewNote: dto.reviewNote ?? null,
      scoreBefore: dto.scoreBefore ?? null,
      scoreAfter: dto.scoreAfter ?? null,
    });
    await this.audit.log({
      examSessionId: row.examSessionId,
      eventType: AuditEventType.APPEAL_REVIEWED,
      payload: { appealId: id, status: dto.status, sbd: row.sbd },
    });
    return this.appealRepo.findOne({ where: { id } });
  }
}
