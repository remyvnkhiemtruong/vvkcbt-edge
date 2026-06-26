import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AppealStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected';

@Entity('appeal_requests')
@Index(['examSessionId', 'sbd'])
export class AppealRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_session_id', type: 'uuid' })
  examSessionId: string;

  @Column({ type: 'varchar' })
  sbd: string;

  @Column({ name: 'subject_code', type: 'varchar' })
  subjectCode: string;

  @Column({ name: 'question_id', type: 'varchar', nullable: true })
  questionId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: AppealStatus;

  @Column({ name: 'reviewed_by', type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ name: 'score_before', type: 'float', nullable: true })
  scoreBefore: number | null;

  @Column({ name: 'score_after', type: 'float', nullable: true })
  scoreAfter: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
