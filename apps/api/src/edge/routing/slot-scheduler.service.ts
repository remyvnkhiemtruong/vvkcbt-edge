import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, In } from 'typeorm';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { ProctoringGateway } from '../proctoring/proctoring.gateway';

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
      if (slot.status !== 'completed') {
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
    if (!slot) throw new Error('Slot not found');
    if (slot.status === 'completed') throw new Error('Slot already completed');
    await this.slotRepo.update(slotId, { status: 'open' });
    this.proctoringGateway.broadcastScheduleUpdate(slot.examSessionId, {
      reason: 'slot_opened',
      slotId,
      subjectCode: slot.subjectCode,
      status: 'open',
    });
    return { ok: true, slotId };
  }

  async extendSlot(slotId: string, extraMinutes: number) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new Error('Slot not found');
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
