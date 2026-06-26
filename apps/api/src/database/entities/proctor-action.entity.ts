import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { ProctorActionType } from '@vnu/shared-types';

@Entity('proctor_actions')
export class ProctorAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_session_id' })
  examSessionId: string;

  @Column({ name: 'student_session_id' })
  studentSessionId: string;

  @Column({ type: 'enum', enum: ProctorActionType })
  actionType: ProctorActionType;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ nullable: true })
  proctorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
