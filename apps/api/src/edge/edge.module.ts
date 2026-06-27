import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { StudentSession } from '../database/entities/student-session.entity';
import { ExamSession } from '../database/entities/exam-session.entity';
import { Student } from '../database/entities/student.entity';
import { School } from '../database/entities/school.entity';
import { Class } from '../database/entities/class.entity';
import { ExamPaper } from '../database/entities/exam-paper.entity';
import { ProctorAction } from '../database/entities/proctor-action.entity';
import { GdptSubjectStream } from '../database/entities/gdpt-subject-stream.entity';
import { StudentSubjectSlot } from '../database/entities/student-subject-slot.entity';
import { AppealRequest } from '../database/entities/appeal-request.entity';
import { QuestionCluster } from '../database/entities/question-cluster.entity';
import { MediaAsset } from '../database/entities/media-asset.entity';
import { TnptComboCatalog } from '../database/entities/tnpt-combo-catalog.entity';
import { ExamStructureTemplate } from '../database/entities/exam-structure-template.entity';
import { StudentAuthController } from './auth/student-auth.controller';
import { StudentAuthService } from './auth/student-auth.service';
import { ExamRouterService } from './routing/exam-router.service';
import { ProctoringGateway } from './proctoring/proctoring.gateway';
import { ProctorController } from './proctoring/proctor.controller';
import { ProctorScoreService } from './proctoring/proctor-score.service';
import { RoomScoreSheetService } from './proctoring/room-score-sheet.service';
import { SubjectRoomCompletionService } from './proctoring/subject-room-completion.service';
import { AppealService } from './proctoring/appeal.service';
import { RoomArchiveService } from './proctoring/room-archive.service';
import { SubmitRetryProcessor } from './workers/submit-retry.processor';
import { CoreModule } from '../core/core.module';
import { PostExamModule } from '../post-exam/post-exam.module';
import { SlotSchedulerService } from './routing/slot-scheduler.service';
import { isEdgeLightweight } from '../shared/config/edge-env';

const lightweight = isEdgeLightweight();

@Module({
  imports: [
    CoreModule,
    PostExamModule,
    TypeOrmModule.forFeature([
      StudentSession,
      ExamSession,
      Student,
      School,
      Class,
      ExamPaper,
      ProctorAction,
      GdptSubjectStream,
      StudentSubjectSlot,
      AppealRequest,
      QuestionCluster,
      MediaAsset,
      TnptComboCatalog,
      ExamStructureTemplate,
    ]),
    ...(lightweight ? [] : [BullModule.registerQueue({ name: 'submit-retry' })]),
  ],
  controllers: [StudentAuthController, ProctorController],
  providers: [
    StudentAuthService,
    ExamRouterService,
    ProctoringGateway,
    ProctorScoreService,
    RoomScoreSheetService,
    SubjectRoomCompletionService,
    AppealService,
    RoomArchiveService,
    ...(lightweight ? [] : [SubmitRetryProcessor]),
    SlotSchedulerService,
  ],
  exports: [ProctoringGateway],
})
export class EdgeModule {}
