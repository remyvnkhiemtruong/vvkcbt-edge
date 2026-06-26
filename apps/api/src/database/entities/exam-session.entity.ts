import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExamRules, SubjectRoutingConfig } from '@vnu/shared-types';

@Entity('exam_sessions')
export class ExamSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'routing_mode', default: 'fixed_combo' })
  routingMode: string;

  @Column({ type: 'jsonb', default: {} })
  rules: ExamRules;

  /** Định tuyến động môn thi / tổ hợp — tách khỏi rules để Admin chỉnh không ảnh hưởng chấm điểm */
  @Column({ name: 'routing_config', type: 'jsonb', default: {} })
  routingConfig: SubjectRoutingConfig;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt: Date;

  @Column({ name: 'duration_min', default: 90 })
  durationMin: number;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'package_id', type: 'uuid', nullable: true, unique: true })
  packageId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
