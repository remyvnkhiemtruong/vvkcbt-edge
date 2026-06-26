import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubjectSlotScores1719600000000 implements MigrationInterface {
  name = 'SubjectSlotScores1719600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_subject_slots
        ADD COLUMN IF NOT EXISTS score_result JSONB,
        ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS violation_count INT NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE student_subject_slots
        DROP COLUMN IF EXISTS violation_count,
        DROP COLUMN IF EXISTS submitted_at,
        DROP COLUMN IF EXISTS score_result
    `);
  }
}
