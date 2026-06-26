import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StructureSource } from '@vnu/shared-types';

@Entity('exam_structure_templates')
export class ExamStructureTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  subject: string;

  @Column({ type: 'enum', enum: StructureSource, default: StructureSource.QD764 })
  source: StructureSource;

  @Column({ name: 'is_custom', default: false })
  isCustom: boolean;

  @Column({ name: 'duration_min' })
  durationMin: number;

  @Column({ name: 'total_score', type: 'decimal', precision: 4, scale: 1, default: 10 })
  totalScore: number;

  @Column({ type: 'jsonb' })
  parts: Record<string, unknown>;

  @Column({ name: 'cluster_layout', type: 'jsonb', nullable: true })
  clusterLayout: Record<string, unknown> | null;

  @Column({ name: 'cognitive_distribution', type: 'jsonb', nullable: true })
  cognitiveDistribution: Record<string, number> | null;

  @Column({ name: 'ui_mode', default: 'vertical_focus' })
  uiMode: string;

  @Column({ name: 'parent_template_id', type: 'uuid', nullable: true })
  parentTemplateId: string | null;

  @ManyToOne(() => ExamStructureTemplate, { nullable: true })
  @JoinColumn({ name: 'parent_template_id' })
  parentTemplate: ExamStructureTemplate | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
