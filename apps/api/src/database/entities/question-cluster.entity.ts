import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Difficulty } from '@vnu/shared-types';

@Entity('question_clusters')
export class QuestionCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'ENGLISH' })
  subject: string;

  @Column({ name: 'cluster_subtype' })
  clusterSubtype: string;

  @Column({ type: 'jsonb' })
  passage: Record<string, unknown>;

  @Column({ name: 'question_ids', type: 'jsonb', default: [] })
  questionIds: string[];

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.MEDIUM })
  difficulty: Difficulty;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
