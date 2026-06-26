import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Class } from './class.entity';
import { Student } from './student.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @OneToMany(() => Class, (c) => c.school)
  classes: Class[];

  @OneToMany(() => Student, (s) => s.school)
  students: Student[];

  @CreateDateColumn()
  createdAt: Date;
}
