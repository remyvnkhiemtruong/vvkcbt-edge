import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppealRequests1720200000000 implements MigrationInterface {
  name = 'AppealRequests1720200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS appeal_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exam_session_id UUID NOT NULL,
        sbd VARCHAR NOT NULL,
        subject_code VARCHAR NOT NULL,
        question_id VARCHAR,
        reason TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR,
        review_note TEXT,
        score_before DOUBLE PRECISION,
        score_after DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_appeal_requests_exam_session_sbd
      ON appeal_requests (exam_session_id, sbd)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_appeal_requests_exam_session_sbd`);
    await queryRunner.query(`DROP TABLE IF EXISTS appeal_requests`);
  }
}
