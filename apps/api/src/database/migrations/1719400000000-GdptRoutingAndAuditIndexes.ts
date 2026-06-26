import { MigrationInterface, QueryRunner } from 'typeorm';

export class GdptRoutingAndAuditIndexes1719400000000 implements MigrationInterface {
  name = 'GdptRoutingAndAuditIndexes1719400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE exam_sessions
        ADD COLUMN IF NOT EXISTS routing_config JSONB DEFAULT '{}';

      CREATE INDEX IF NOT EXISTS idx_exam_sessions_routing_config
        ON exam_sessions USING GIN (routing_config);

      CREATE INDEX IF NOT EXISTS idx_exam_sessions_rules
        ON exam_sessions USING GIN (rules);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gdpt_subject_streams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        stream_code VARCHAR NOT NULL,
        stream_name VARCHAR NOT NULL,
        grade VARCHAR DEFAULT '12',
        subject_codes JSONB DEFAULT '[]',
        stream_config JSONB DEFAULT '{}',
        exam_paper_id UUID REFERENCES exam_papers(id),
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (exam_session_id, stream_code)
      );

      CREATE INDEX IF NOT EXISTS idx_gdpt_streams_session
        ON gdpt_subject_streams(exam_session_id);

      CREATE INDEX IF NOT EXISTS idx_gdpt_streams_subject_codes
        ON gdpt_subject_streams USING GIN (subject_codes);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_student_session
        ON audit_logs(student_session_id, "createdAt" DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_event_type
        ON audit_logs("eventType", "createdAt" DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_payload
        ON audit_logs USING GIN (payload);

      CREATE INDEX IF NOT EXISTS idx_audit_ip
        ON audit_logs(ip) WHERE ip IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_student_sessions_answers
        ON student_sessions USING GIN (answers);

      CREATE INDEX IF NOT EXISTS idx_question_bank_content
        ON question_bank USING GIN (content);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS gdpt_subject_streams;
      ALTER TABLE exam_sessions DROP COLUMN IF EXISTS routing_config;
    `);
  }
}
