import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('grading_flags')
export class GradingFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_session_id' })
  studentSessionId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'student_answer', type: 'text' })
  studentAnswer: string;

  @Column({ default: 'format_mismatch' })
  reason: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'reviewed_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  reviewedScore: number;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string;

  @Column({ name: 'rubric_scores', type: 'jsonb', nullable: true })
  rubricScores?: Array<{ partKey: string; score: number; maxScore: number }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
