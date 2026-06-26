import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('media_assets')
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  path: string;

  @Column()
  mimeType: string;

  @Column({ nullable: true })
  checksum: string;

  @Column({ default: false })
  encrypted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
