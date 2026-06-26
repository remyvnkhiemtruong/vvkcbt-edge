import { MigrationInterface, QueryRunner } from 'typeorm';

export class RoomExportedAt1720100000000 implements MigrationInterface {
  name = 'RoomExportedAt1720100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE exam_sessions
        ADD COLUMN IF NOT EXISTS room_exported_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE exam_sessions DROP COLUMN IF EXISTS room_exported_at
    `);
  }
}
