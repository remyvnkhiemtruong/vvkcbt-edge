import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, In } from 'typeorm';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { ProctoringGateway } from '../proctoring/proctoring.gateway';

export interface SubjectScheduleRow {
  subjectCode: string;
  nameVi: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'scheduled' | 'open' | 'locked' | 'completed' | 'partial';
  counts: { scheduled: number; open: number; locked: number; completed: number; total: number };
  canOpen: boolean;
}

@Injectable()
export class SlotSchedulerService {
  private readonly logger = new Logger(SlotSchedulerService.name);

  constructor(
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    private readonly proctoringGateway: ProctoringGateway,
  ) {}

  @Cron('* * * * *')
  async tick() {
    const now = new Date();
    const toOpen = await this.slotRepo.find({
      where: {
        status: 'scheduled',
        scheduledStart: LessThanOrEqual(now),
        scheduledEnd: MoreThan(now),
      },
    });

    const sessionIds = [...new Set(toOpen.map((s) => s.examSessionId))];
    const sessions = sessionIds.length
      ? await this.examSessionRepo.find({ where: { id: In(sessionIds) } })
      : [];
    const proctorAtTimeIds = new Set(
      sessions
        .filter((s) => s.rules?.proctoring?.release_mode === 'proctor_at_time')
        .map((s) => s.id),
    );

    const openedSessions = new Set<string>();
    let opened = 0;
    for (const slot of toOpen) {
      if (proctorAtTimeIds.has(slot.examSessionId)) continue;
      await this.slotRepo.update(slot.id, { status: 'open' });
      openedSessions.add(slot.examSessionId);
      opened++;
    }
    if (opened) {
      this.logger.log(`Opened ${opened} subject slots`);
      for (const examSessionId of openedSessions) {
        this.proctoringGateway.broadcastScheduleUpdate(examSessionId, { reason: 'slots_batch' });
      }
    }

    const toLock = await this.slotRepo.find({
      where: {
        status: In(['scheduled', 'open']),
        scheduledEnd: LessThanOrEqual(now),
      },
    });
    const lockedSessions = new Set<string>();
    for (const slot of toLock) {
      if (slot.status !== 'completed' && !slot.studentSessionId) {
        await this.slotRepo.update(slot.id, { status: 'locked' });
        lockedSessions.add(slot.examSessionId);
      }
    }
    if (toLock.length) {
      this.logger.log(`Locked ${toLock.length} subject slots`);
      for (const examSessionId of lockedSessions) {
        this.proctoringGateway.broadcastScheduleUpdate(examSessionId, { reason: 'slots_batch' });
      }
    }
  }

  async openEarly(slotId: string) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new BadRequestException('Không tìm thấy ca thi');
    if (slot.status === 'completed') throw new BadRequestException('Ca thi đã hoàn thành');
    await this.slotRepo.update(slotId, { status: 'open' });
    this.proctoringGateway.broadcastScheduleUpdate(slot.examSessionId, {
      reason: 'slot_opened',
      slotId,
      subjectCode: slot.subjectCode,
      status: 'open',
    });
    return { ok: true, slotId };
  }

  async openSubjectSlots(examSessionId: string, subjectCode: string) {
    const code = subjectCode.trim().toUpperCase();
    const slots = await this.slotRepo.find({
      where: { examSessionId, subjectCode: code, status: 'scheduled' },
    });
    if (!slots.length) {
      throw new BadRequestException('Môn này không còn ca chờ mở (đã mở hoặc đã kết thúc)');
    }
    const now = new Date();
    const expired = slots.every((s) => now > s.scheduledEnd);
    if (expired) {
      throw new BadRequestException('Đã hết thời gian ca thi môn này');
    }
    for (const slot of slots) {
      await this.slotRepo.update(slot.id, { status: 'open' });
    }
    this.proctoringGateway.broadcastScheduleUpdate(examSessionId, {
      reason: 'slots_batch',
      subjectCode: code,
      status: 'open',
    });
    this.logger.log(`Proctor opened ${slots.length} slots for ${code} in session ${examSessionId}`);
    return { ok: true, subjectCode: code, opened: slots.length };
  }

  async getSubjectSchedule(examSessionId: string): Promise<{ subjects: SubjectScheduleRow[] }> {
    const slots = await this.slotRepo.find({
      where: { examSessionId },
      order: { scheduledStart: 'ASC' },
    });
    const bySubject = new Map<string, StudentSubjectSlot[]>();
    for (const slot of slots) {
      const list = bySubject.get(slot.subjectCode) ?? [];
      list.push(slot);
      bySubject.set(slot.subjectCode, list);
    }

    const subjects: SubjectScheduleRow[] = [...bySubject.entries()].map(([subjectCode, subjectSlots]) => {
      const meta = TN_THPT_SUBJECTS.find((s) => s.code === subjectCode);
      const counts = { scheduled: 0, open: 0, locked: 0, completed: 0, total: subjectSlots.length };
      for (const s of subjectSlots) {
        if (s.status === 'scheduled') counts.scheduled += 1;
        else if (s.status === 'open') counts.open += 1;
        else if (s.status === 'locked') counts.locked += 1;
        else if (s.status === 'completed') counts.completed += 1;
      }
      const scheduledStart = subjectSlots.reduce<Date | null>(
        (min, s) => (!min || s.scheduledStart < min ? s.scheduledStart : min),
        null,
      );
      const scheduledEnd = subjectSlots.reduce<Date | null>(
        (max, s) => (!max || s.scheduledEnd > max ? s.scheduledEnd : max),
        null,
      );
      let status: SubjectScheduleRow['status'] = 'scheduled';
      if (counts.completed === counts.total) status = 'completed';
      else if (counts.locked > 0 && counts.open === 0 && counts.scheduled === 0) status = 'locked';
      else if (counts.open > 0 && counts.scheduled === 0) status = 'open';
      else if (counts.open > 0) status = 'partial';
      else if (counts.scheduled > 0) status = 'scheduled';

      return {
        subjectCode,
        nameVi: meta?.nameVi ?? subjectCode,
        scheduledStart: scheduledStart?.toISOString() ?? null,
        scheduledEnd: scheduledEnd?.toISOString() ?? null,
        status,
        counts,
        canOpen: counts.scheduled > 0,
      };
    });

    subjects.sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));
    return { subjects };
  }

  async extendSlot(slotId: string, extraMinutes: number) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new BadRequestException('Không tìm thấy ca thi');
    const end = new Date(slot.scheduledEnd);
    end.setMinutes(end.getMinutes() + extraMinutes);
    await this.slotRepo.update(slotId, { scheduledEnd: end });
    this.proctoringGateway.broadcastScheduleUpdate(slot.examSessionId, {
      reason: 'slot_extended',
      slotId,
      subjectCode: slot.subjectCode,
      scheduledEnd: end.toISOString(),
    });
    return { ok: true, scheduledEnd: end };
  }
}
