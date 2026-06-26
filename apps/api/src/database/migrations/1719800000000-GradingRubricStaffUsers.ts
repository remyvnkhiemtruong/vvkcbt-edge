import { MigrationInterface, QueryRunner } from 'typeorm';

export class GradingRubricStaffUsers1719800000000 implements MigrationInterface {
  name = 'GradingRubricStaffUsers1719800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE grading_flags
      ADD COLUMN IF NOT EXISTS rubric_scores JSONB
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(64) NOT NULL UNIQUE,
        role VARCHAR(32) NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        school_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS staff_users`);
    await queryRunner.query(`ALTER TABLE grading_flags DROP COLUMN IF EXISTS rubric_scores`);
  }
}
