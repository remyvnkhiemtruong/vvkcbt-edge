import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradingFlag } from '../database/entities/grading-flag.entity';
import { StudentSession } from '../database/entities/student-session.entity';
import { StudentSubjectSlot } from '../database/entities/student-subject-slot.entity';
import { AnonymizationMap } from '../database/entities/anonymization-map.entity';
import { DifficultyStat } from '../database/entities/difficulty-stat.entity';
import { QuestionBank } from '../database/entities/question-bank.entity';
import { PostExamController } from './post-exam.controller';
import { ManualReviewService } from './grading/manual-review.service';
import { AnonymizationService } from './anonymization/anonymization.service';
import { CalibrationService } from './calibration/calibration.service';
import { PdfService } from './pdf/pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GradingFlag,
      StudentSession,
      StudentSubjectSlot,
      AnonymizationMap,
      DifficultyStat,
      QuestionBank,
    ]),
  ],
  controllers: [PostExamController],
  providers: [ManualReviewService, AnonymizationService, CalibrationService, PdfService],
})
export class PostExamModule {}
