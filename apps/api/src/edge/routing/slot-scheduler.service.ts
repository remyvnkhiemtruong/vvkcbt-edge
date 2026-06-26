import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, Not, In } from 'typeorm';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';

@Injectable()
export class SlotSchedulerService {
  private readonly logger = new Logger(SlotSchedulerService.name);

  constructor(
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
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

    let opened = 0;
    for (const slot of toOpen) {
      if (proctorAtTimeIds.has(slot.examSessionId)) continue;
      await this.slotRepo.update(slot.id, { status: 'open' });
      opened++;
    }
    if (opened) this.logger.log(`Opened ${opened} subject slots`);

    const toLock = await this.slotRepo.find({
      where: {
        status: In(['scheduled', 'open']),
        scheduledEnd: LessThanOrEqual(now),
      },
    });
    for (const slot of toLock) {
      if (slot.status !== 'completed') {
        await this.slotRepo.update(slot.id, { status: 'locked' });
      }
    }
    if (toLock.length) this.logger.log(`Locked ${toLock.length} subject slots`);
  }

  async openEarly(slotId: string) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new Error('Slot not found');
    if (slot.status === 'completed') throw new Error('Slot already completed');
    await this.slotRepo.update(slotId, { status: 'open' });
    return { ok: true, slotId };
  }

  async extendSlot(slotId: string, extraMinutes: number) {
    const slot = await this.slotRepo.findOne({ where: { id: slotId } });
    if (!slot) throw new Error('Slot not found');
    const end = new Date(slot.scheduledEnd);
    end.setMinutes(end.getMinutes() + extraMinutes);
    await this.slotRepo.update(slotId, { scheduledEnd: end });
    return { ok: true, scheduledEnd: end };
  }
}
