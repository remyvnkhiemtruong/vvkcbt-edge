import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentSessionStatus } from '@vnu/shared-types';
import { Student } from './student.entity';
import { ExamSession } from './exam-session.entity';
import { ExamPaper } from './exam-paper.entity';

@Entity('student_sessions')
export class StudentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sbd: string;

  @Column({ name: 'exam_account', type: 'varchar', nullable: true, unique: true })
  examAccount: string | null;

  @Column({ name: 'subject_code', type: 'varchar', nullable: true })
  subjectCode: string | null;

  @Column({ name: 'session_version', default: 1 })
  sessionVersion: number;

  @Column({ name: 'pin_hash' })
  pinHash: string;

  @Column({ name: 'bound_ip', nullable: true })
  boundIp: string;

  @Column({ name: 'student_id', nullable: true })
  studentId: string;

  @Column({ name: 'exam_session_id' })
  examSessionId: string;

  @Column({ name: 'exam_paper_id', nullable: true })
  examPaperId: string;

  @Column({
    type: 'enum',
    enum: StudentSessionStatus,
    default: StudentSessionStatus.NOT_LOGGED_IN,
  })
  status: StudentSessionStatus;

  @Column({ type: 'jsonb', default: {} })
  answers: Record<string, unknown>;

  @Column({ type: 'jsonb', default: { count: 0, events: [] } })
  violations: { count: number; events: unknown[] };

  @Column({ name: 'time_extension_min', default: 0 })
  timeExtensionMin: number;

  @Column({ default: false })
  locked: boolean;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  scoreResult?: Record<string, unknown>;

  @Column({ name: 'last_heartbeat', type: 'timestamptz', nullable: true })
  lastHeartbeat: Date;

  @ManyToOne(() => Student, { nullable: true })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => ExamSession)
  @JoinColumn({ name: 'exam_session_id' })
  examSession: ExamSession;

  @ManyToOne(() => ExamPaper, { nullable: true })
  @JoinColumn({ name: 'exam_paper_id' })
  examPaper: ExamPaper;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
