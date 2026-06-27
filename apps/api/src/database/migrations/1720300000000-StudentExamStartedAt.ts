import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentExamStartedAt1720300000000 implements MigrationInterface {
  name = 'StudentExamStartedAt1720300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_sessions
        ADD COLUMN IF NOT EXISTS exam_started_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_sessions
        DROP COLUMN IF EXISTS exam_started_at
    `);
  }
}
