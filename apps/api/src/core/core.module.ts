import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBank } from '../database/entities/question-bank.entity';
import { ExamPaper } from '../database/entities/exam-paper.entity';
import { ExamSession } from '../database/entities/exam-session.entity';
import { MediaAsset } from '../database/entities/media-asset.entity';
import { Student } from '../database/entities/student.entity';
import { School } from '../database/entities/school.entity';
import { Class } from '../database/entities/class.entity';
import { StudentSession } from '../database/entities/student-session.entity';
import { ExamStructureTemplate } from '../database/entities/exam-structure-template.entity';
import { QuestionCluster } from '../database/entities/question-cluster.entity';
import { TnptComboCatalog } from '../database/entities/tnpt-combo-catalog.entity';
import { GdptSubjectStream } from '../database/entities/gdpt-subject-stream.entity';
import { StudentSubjectSlot } from '../database/entities/student-subject-slot.entity';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { FisherYatesService } from './exam-generation/fisher-yates.service';
import { SessionSchedulerService } from './scheduling/session-scheduler.service';
import { BackupService } from './backup/backup.service';
import { BackupController } from './backup/backup.controller';
import { StructureResolverService } from './structure/structure-resolver.service';
import { StudentImportService } from './students/student-import.service';
import { ExamMasterService } from './exam-master/exam-master.service';
import { ExamPackageService } from './exam-package/exam-package.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionBank,
      ExamPaper,
      ExamSession,
      MediaAsset,
      Student,
      School,
      Class,
      StudentSession,
      ExamStructureTemplate,
      QuestionCluster,
      TnptComboCatalog,
      GdptSubjectStream,
      StudentSubjectSlot,
    ]),
  ],
  controllers: [CoreController, BackupController],
  providers: [CoreService, FisherYatesService, SessionSchedulerService, BackupService, StructureResolverService, StudentImportService, ExamMasterService, ExamPackageService],
  exports: [CoreService, BackupService, StructureResolverService, StudentImportService, ExamMasterService, ExamPackageService, SessionSchedulerService],
})
export class CoreModule {}
