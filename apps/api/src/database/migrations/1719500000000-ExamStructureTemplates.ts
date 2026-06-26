import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExamStructureTemplates1719500000000 implements MigrationInterface {
  name = 'ExamStructureTemplates1719500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE question_type_enum ADD VALUE IF NOT EXISTS 'essay';
      ALTER TYPE question_type_enum ADD VALUE IF NOT EXISTS 'cluster_mcq';
    `);

    await queryRunner.query(`
      CREATE TYPE structure_source_enum AS ENUM ('QD764', 'custom');
      CREATE TYPE gdpt_assessment_period_enum AS ENUM ('GK1', 'GK2', 'CK1', 'CK2');
    `);

    await queryRunner.query(`
      CREATE TABLE exam_structure_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR NOT NULL UNIQUE,
        subject VARCHAR NOT NULL,
        source structure_source_enum DEFAULT 'QD764',
        is_custom BOOLEAN DEFAULT FALSE,
        duration_min INT NOT NULL,
        total_score DECIMAL(4,1) DEFAULT 10.0,
        parts JSONB NOT NULL,
        cluster_layout JSONB,
        cognitive_distribution JSONB,
        ui_mode VARCHAR DEFAULT 'vertical_focus',
        parent_template_id UUID REFERENCES exam_structure_templates(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX idx_structure_templates_subject ON exam_structure_templates(subject);
    `);

    await queryRunner.query(`
      CREATE TABLE question_clusters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject VARCHAR NOT NULL DEFAULT 'ENGLISH',
        cluster_subtype VARCHAR NOT NULL,
        passage JSONB NOT NULL,
        question_ids JSONB NOT NULL DEFAULT '[]',
        difficulty difficulty_enum DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE question_bank
        ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES question_clusters(id),
        ADD COLUMN IF NOT EXISTS cluster_order INT;
    `);

    await queryRunner.query(`
      CREATE TABLE tnpt_combo_catalog (
        combo_code VARCHAR(4) PRIMARY KEY,
        combo_name VARCHAR NOT NULL,
        subjects JSONB NOT NULL,
        admission_blocks JSONB,
        active_from INT DEFAULT 2025
      );
    `);

    await queryRunner.query(`
      CREATE TABLE student_subject_slots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
        subject_code VARCHAR NOT NULL,
        structure_template_id UUID REFERENCES exam_structure_templates(id),
        scheduled_start TIMESTAMPTZ NOT NULL,
        scheduled_end TIMESTAMPTZ NOT NULL,
        student_session_id UUID REFERENCES student_sessions(id),
        status VARCHAR DEFAULT 'scheduled',
        UNIQUE (student_id, exam_session_id, subject_code)
      );

      CREATE INDEX idx_subject_slots_session ON student_subject_slots(exam_session_id);
      CREATE INDEX idx_subject_slots_student ON student_subject_slots(student_id);
    `);

    await queryRunner.query(`
      ALTER TABLE gdpt_subject_streams
        ADD COLUMN IF NOT EXISTS assessment_period gdpt_assessment_period_enum,
        ADD COLUMN IF NOT EXISTS structure_template_id UUID REFERENCES exam_structure_templates(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gdpt_subject_streams
        DROP COLUMN IF EXISTS structure_template_id,
        DROP COLUMN IF EXISTS assessment_period;
      DROP TABLE IF EXISTS student_subject_slots;
      DROP TABLE IF EXISTS tnpt_combo_catalog;
      ALTER TABLE question_bank DROP COLUMN IF EXISTS cluster_order;
      ALTER TABLE question_bank DROP COLUMN IF EXISTS cluster_id;
      DROP TABLE IF EXISTS question_clusters;
      DROP TABLE IF EXISTS exam_structure_templates;
      DROP TYPE IF EXISTS gdpt_assessment_period_enum;
      DROP TYPE IF EXISTS structure_source_enum;
    `);
  }
}
