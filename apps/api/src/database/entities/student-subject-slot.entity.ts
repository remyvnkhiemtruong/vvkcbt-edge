import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Student } from './student.entity';
import { ExamSession } from './exam-session.entity';
import { ExamStructureTemplate } from './exam-structure-template.entity';
import { StudentSession } from './student-session.entity';

export type SubjectSlotStatus = 'scheduled' | 'open' | 'locked' | 'completed';

@Entity('student_subject_slots')
@Index(['studentId', 'examSessionId', 'subjectCode'], { unique: true })
export class StudentSubjectSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'exam_session_id' })
  examSessionId: string;

  @ManyToOne(() => ExamSession)
  @JoinColumn({ name: 'exam_session_id' })
  examSession: ExamSession;

  @Column({ name: 'subject_code' })
  subjectCode: string;

  @Column({ name: 'structure_template_id', type: 'uuid', nullable: true })
  structureTemplateId: string | null;

  @ManyToOne(() => ExamStructureTemplate, { nullable: true })
  @JoinColumn({ name: 'structure_template_id' })
  structureTemplate: ExamStructureTemplate | null;

  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz' })
  scheduledEnd: Date;

  @Column({ name: 'student_session_id', type: 'uuid', nullable: true })
  studentSessionId: string | null;

  @ManyToOne(() => StudentSession, { nullable: true })
  @JoinColumn({ name: 'student_session_id' })
  studentSession: StudentSession | null;

  @Column({ default: 'scheduled' })
  status: SubjectSlotStatus;

  @Column({ name: 'score_result', type: 'jsonb', nullable: true })
  scoreResult?: Record<string, unknown>;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'violation_count', default: 0 })
  violationCount: number;
}
