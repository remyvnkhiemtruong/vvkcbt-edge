import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Difficulty } from '@vnu/shared-types';
import { GradingFlag } from '../../database/entities/grading-flag.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { QuestionBank } from '../../database/entities/question-bank.entity';

@Injectable()
export class ManualReviewService {
  constructor(
    @InjectRepository(GradingFlag)
    private readonly flagRepo: Repository<GradingFlag>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(QuestionBank)
    private readonly questionRepo: Repository<QuestionBank>,
  ) {}

  async listPending(examSessionId?: string) {
    const qb = this.flagRepo
      .createQueryBuilder('f')
      .leftJoin(StudentSession, 'ss', 'ss.id = f.student_session_id')
      .where('f.status = :status', { status: 'pending' });

    if (examSessionId) {
      qb.andWhere('ss.exam_session_id = :examSessionId', { examSessionId });
    }

    const flags = await qb.orderBy('f.created_at', 'ASC').getMany();
    const enriched = await Promise.all(
      flags.map(async (f) => {
        const q = await this.questionRepo.findOne({ where: { id: f.questionId } });
        const content = q?.content as { stem?: string } | undefined;
        return {
          ...f,
          questionStem: content?.stem?.slice(0, 120) ?? f.questionId,
          standardAnswer: String(q?.correctKey ?? '—'),
          maxScore: Number(q?.maxScore ?? 0.25),
        };
      }),
    );
    return enriched;
  }

  async review(
    flagId: string,
    reviewedScore: number,
    reviewedBy: string,
    rubricScores?: Array<{ partKey: string; score: number; maxScore: number }>,
  ) {
    const flag = await this.flagRepo.findOne({ where: { id: flagId } });
    if (!flag) throw new NotFoundException('Flag not found');

    const finalScore =
      rubricScores?.length
        ? rubricScores.reduce((s, p) => s + p.score, 0)
        : reviewedScore;

    flag.status = 'reviewed';
    flag.reviewedScore = finalScore;
    flag.reviewedBy = reviewedBy;
    if (rubricScores) flag.rubricScores = rubricScores;
    await this.flagRepo.save(flag);

    const session = await this.sessionRepo.findOne({
      where: { id: flag.studentSessionId },
      relations: ['student'],
    });
    if (session?.scoreResult) {
      const breakdown = session.scoreResult.breakdown as Array<{
        questionId: string;
        score: number;
      }>;
      const item = breakdown.find((b) => b.questionId === flag.questionId);
      if (item) {
        item.score = finalScore;
        session.scoreResult.total = breakdown.reduce((s, b) => s + b.score, 0);
        await this.sessionRepo.save(session);
      }
    }

    if (session) {
      const subjectCode = (await this.questionRepo.findOne({ where: { id: flag.questionId } }))?.subject;
      if (subjectCode) {
        const slot = await this.slotRepo.findOne({
          where: {
            studentId: session.studentId,
            examSessionId: session.examSessionId,
            subjectCode,
          },
        });
        if (slot) {
          slot.scoreResult = {
            total: Number(session.scoreResult?.total ?? finalScore),
            breakdown: session.scoreResult?.breakdown,
            rubricScores: rubricScores ?? undefined,
          };
          await this.slotRepo.save(slot);
        }
      }
    }

    return flag;
  }
}
