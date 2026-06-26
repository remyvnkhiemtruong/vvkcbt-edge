import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentSessionV121719900000000 implements MigrationInterface {
  name = 'StudentSessionV121719900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_sessions
        ADD COLUMN IF NOT EXISTS exam_account VARCHAR,
        ADD COLUMN IF NOT EXISTS subject_code VARCHAR,
        ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE student_sessions
      SET exam_account = sbd
      WHERE exam_account IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_sessions_exam_account
      ON student_sessions (exam_account)
      WHERE exam_account IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_sessions_session_student_subject
      ON student_sessions (exam_session_id, student_id, subject_code)
      WHERE subject_code IS NOT NULL AND student_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_student_sessions_session_student_subject`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_student_sessions_exam_account`);
    await queryRunner.query(`
      ALTER TABLE student_sessions
        DROP COLUMN IF EXISTS session_version,
        DROP COLUMN IF EXISTS subject_code,
        DROP COLUMN IF EXISTS exam_account
    `);
  }
}
