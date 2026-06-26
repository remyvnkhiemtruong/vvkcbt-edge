import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Difficulty } from '@vnu/shared-types';

@Entity('difficulty_stats')
@Index(['questionId'], { unique: true })
export class DifficultyStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ type: 'enum', enum: Difficulty })
  difficulty: Difficulty;

  @Column({ name: 'total_attempts', default: 0 })
  totalAttempts: number;

  @Column({ name: 'correct_count', default: 0 })
  correctCount: number;

  @Column({ name: 'correct_rate', type: 'decimal', precision: 5, scale: 4, default: 0 })
  correctRate: number;

  @Column({ name: 'calibration_alert', default: false })
  calibrationAlert: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
