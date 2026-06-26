import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('anonymization_map')
@Index(['hashCode'], { unique: true })
export class AnonymizationMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'exam_session_id' })
  examSessionId: string;

  @Column({ name: 'hash_code' })
  hashCode: string;

  @Column({ name: 'revealed_at', type: 'timestamptz', nullable: true })
  revealedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
