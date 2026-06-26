import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { School } from './school.entity';
import { Class } from './class.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  studentCode: string;

  @Column({ name: 'combo_code', nullable: true })
  comboCode: string;

  @Column({ name: 'subject_group', nullable: true })
  subjectGroup: string;

  @Column({ name: 'school_id', nullable: true })
  schoolId: string;

  @Column({ name: 'class_id', nullable: true })
  classId: string;

  @Column({ name: 'lab_room', nullable: true })
  labRoom: string | null;

  @ManyToOne(() => School, (s) => s.students, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @ManyToOne(() => Class, (c) => c.students, { nullable: true })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @CreateDateColumn()
  createdAt: Date;
}
