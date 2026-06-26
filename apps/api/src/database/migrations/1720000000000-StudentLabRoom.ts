import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentLabRoom1720000000000 implements MigrationInterface {
  name = 'StudentLabRoom1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS lab_room VARCHAR(128)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE students
        DROP COLUMN IF EXISTS lab_room
    `);
  }
}
