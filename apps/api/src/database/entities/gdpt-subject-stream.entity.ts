import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ExamSession } from './exam-session.entity';
import { ExamPaper } from './exam-paper.entity';
import { GdptStreamConfig, GdptAssessmentPeriod } from '@vnu/shared-types';

/**
 * Phân luồng ca thi GDPT 2018 — mỗi ban môn / khối lớp trong một ca thi.
 * Bổ sung cho routing_mode = 'dynamic_subject'.
 */
@Entity('gdpt_subject_streams')
@Index(['examSessionId', 'streamCode'], { unique: true })
export class GdptSubjectStream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_session_id' })
  examSessionId: string;

  @ManyToOne(() => ExamSession)
  @JoinColumn({ name: 'exam_session_id' })
  examSession: ExamSession;

  @Column({ name: 'stream_code' })
  streamCode: string;

  @Column({ name: 'stream_name' })
  streamName: string;

  @Column({ default: '12' })
  grade: string;

  /** Danh sách mã môn thuộc luồng: ["MATH","PHYSICS","CHEMISTRY"] */
  @Column({ name: 'subject_codes', type: 'jsonb', default: [] })
  subjectCodes: string[];

  /** Cấu hình mở rộng: time_offset, ui_mode, weight... */
  @Column({ name: 'stream_config', type: 'jsonb', default: {} })
  streamConfig: Partial<GdptStreamConfig>;

  @Column({ name: 'exam_paper_id', type: 'uuid', nullable: true })
  examPaperId: string;

  @ManyToOne(() => ExamPaper, { nullable: true })
  @JoinColumn({ name: 'exam_paper_id' })
  examPaper: ExamPaper;

  @Column({ name: 'assessment_period', type: 'varchar', nullable: true })
  assessmentPeriod: GdptAssessmentPeriod | null;

  @Column({ name: 'structure_template_id', type: 'uuid', nullable: true })
  structureTemplateId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
