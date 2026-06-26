import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('tnpt_combo_catalog')
export class TnptComboCatalog {
  @PrimaryColumn({ name: 'combo_code', length: 4 })
  comboCode: string;

  @Column({ name: 'combo_name' })
  comboName: string;

  @Column({ type: 'jsonb' })
  subjects: string[];

  @Column({ name: 'admission_blocks', type: 'jsonb', nullable: true })
  admissionBlocks: string[] | null;

  @Column({ name: 'active_from', default: 2025 })
  activeFrom: number;
}
