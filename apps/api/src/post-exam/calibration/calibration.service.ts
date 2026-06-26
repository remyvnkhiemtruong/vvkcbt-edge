import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Difficulty } from '@vnu/shared-types';
import { DifficultyStat } from '../../database/entities/difficulty-stat.entity';
import { QuestionBank } from '../../database/entities/question-bank.entity';

@Injectable()
export class CalibrationService {
  constructor(
    @InjectRepository(DifficultyStat)
    private readonly statRepo: Repository<DifficultyStat>,
    @InjectRepository(QuestionBank)
    private readonly questionRepo: Repository<QuestionBank>,
  ) {}

  @Cron('0 */30 * * * *')
  async checkCalibration() {
    const alerts = await this.statRepo.find({
      where: { calibrationAlert: true, difficulty: Difficulty.HIGH },
    });
    return alerts.map((a) => ({
      questionId: a.questionId,
      correctRate: Number(a.correctRate),
      message: `Câu ${a.questionId} (Vận dụng cao) có ${(Number(a.correctRate) * 100).toFixed(1)}% làm đúng — cân nhắc hạ độ khó`,
    }));
  }

  async getAlerts() {
    const stats = await this.statRepo.find({
      where: { calibrationAlert: true },
      order: { correctRate: 'DESC' },
    });
    return stats.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      correctRate: Number(a.correctRate),
      configuredLevel: a.difficulty,
      calibrationAlert: a.calibrationAlert,
    }));
  }

  async lowerDifficulty(questionId: string) {
    const stat = await this.statRepo.findOne({ where: { questionId } });
    if (stat) {
      stat.difficulty = Difficulty.MEDIUM;
      stat.calibrationAlert = false;
      await this.statRepo.save(stat);
    }
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (question) {
      question.difficulty = Difficulty.MEDIUM;
      await this.questionRepo.save(question);
    }
    if (!stat && !question) throw new NotFoundException('Question not found');
    return { questionId, difficulty: Difficulty.MEDIUM };
  }
}
