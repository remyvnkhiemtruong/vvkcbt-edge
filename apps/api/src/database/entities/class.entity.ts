import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { School } from './school.entity';
import { Student } from './student.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  grade: string;

  @Column({ name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => School, (s) => s.classes)
  @JoinColumn({ name: 'school_id' })
  school: School;

  @OneToMany(() => Student, (s) => s.class)
  students: Student[];
}
