import { Injectable } from '@nestjs/common';
import { scoreAnswer, ExamRules } from '@vnu/shared-types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradingFlag } from '../../database/entities/grading-flag.entity';
import { DifficultyStat } from '../../database/entities/difficulty-stat.entity';
import { QuestionBank } from '../../database/entities/question-bank.entity';
import { Difficulty } from '@vnu/shared-types';

export interface PaperQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'cluster_mcq';
  correctKey: unknown;
  maxScore?: number;
  bankQuestionId?: string;
  partKey?: string;
}

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(GradingFlag)
    private readonly gradingFlagRepo: Repository<GradingFlag>,
    @InjectRepository(DifficultyStat)
    private readonly difficultyStatRepo: Repository<DifficultyStat>,
    @InjectRepository(QuestionBank)
    private readonly questionBankRepo: Repository<QuestionBank>,
  ) {}

  scoreExam(
    questions: PaperQuestion[],
    answers: Record<string, unknown>,
    rules: ExamRules,
    studentSessionId: string,
  ) {
    const breakdown = questions.map((q) => {
      const result = scoreAnswer(
        { id: q.id, type: q.type, correctKey: q.correctKey, maxScore: q.maxScore },
        answers[q.id],
        rules.scoring,
      );
      return {
        questionId: q.id,
        type: q.type,
        score: result.score,
        maxScore: result.maxScore,
        flagged: result.flagged,
      };
    });

    const total = breakdown.reduce((sum, b) => sum + b.score, 0);

    return { total, breakdown };
  }

  async createGradingFlags(
    studentSessionId: string,
    breakdown: Array<{ questionId: string; flagged?: boolean }>,
    answers: Record<string, unknown>,
  ) {
    const flagged = breakdown.filter((b) => b.flagged);
    for (const item of flagged) {
      await this.gradingFlagRepo.save(
        this.gradingFlagRepo.create({
          studentSessionId,
          questionId: item.questionId,
          studentAnswer: String(answers[item.questionId] ?? ''),
          reason: 'format_mismatch',
          status: 'pending',
        }),
      );
    }
  }

  async updateDifficultyStats(questions: PaperQuestion[], answers: Record<string, unknown>) {
    for (const q of questions) {
      if (!q.bankQuestionId) continue;
      const bankQ = await this.questionBankRepo.findOne({ where: { id: q.bankQuestionId } });
      if (!bankQ) continue;

      const result = scoreAnswer(
        { id: q.id, type: q.type, correctKey: q.correctKey, maxScore: q.maxScore },
        answers[q.id],
      );

      let stat = await this.difficultyStatRepo.findOne({ where: { questionId: q.bankQuestionId } });
      if (!stat) {
        stat = this.difficultyStatRepo.create({
          questionId: q.bankQuestionId,
          difficulty: bankQ.difficulty,
          totalAttempts: 0,
          correctCount: 0,
          correctRate: 0,
        });
      }

      stat.totalAttempts += 1;
      if (result.score >= result.maxScore) stat.correctCount += 1;
      stat.correctRate = stat.correctCount / stat.totalAttempts;
      stat.calibrationAlert =
        bankQ.difficulty === Difficulty.HIGH && stat.correctRate > 0.85;
      await this.difficultyStatRepo.save(stat);
    }
  }

  stripCorrectKey<T extends Record<string, unknown>>(question: T): Omit<T, 'correctKey'> {
    const { correctKey: _, ...rest } = question;
    return rest;
  }
}
