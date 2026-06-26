import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuestionType, Difficulty } from '@vnu/shared-types';

@Entity('question_bank')
export class QuestionBank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subject: string;

  @Column({ type: 'enum', enum: QuestionType })
  type: QuestionType;

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.MEDIUM })
  difficulty: Difficulty;

  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  @Column({ name: 'correct_key', type: 'jsonb' })
  correctKey: unknown;

  @Column({ name: 'max_score', type: 'decimal', precision: 5, scale: 2, default: 0.25 })
  maxScore: number;

  @Column({ name: 'ui_mode', nullable: true })
  uiMode: string;

  @Column({ name: 'cluster_id', type: 'uuid', nullable: true })
  clusterId: string | null;

  @Column({ name: 'cluster_order', type: 'int', nullable: true })
  clusterOrder: number | null;

  @Column({ name: 'package_id', type: 'uuid', nullable: true })
  packageId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
