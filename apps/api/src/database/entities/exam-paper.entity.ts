import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExamSession } from './exam-session.entity';

@Entity('exam_papers')
export class ExamPaper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ name: 'combo_code', nullable: true })
  comboCode: string;

  @Column({ name: 'exam_session_id', nullable: true })
  examSessionId: string;

  @ManyToOne(() => ExamSession, { nullable: true })
  @JoinColumn({ name: 'exam_session_id' })
  examSession: ExamSession;

  @Column({ type: 'jsonb', default: [] })
  questions: Record<string, unknown>[];

  @Column({ name: 'difficulty_meta', type: 'jsonb', default: {} })
  difficultyMeta: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
