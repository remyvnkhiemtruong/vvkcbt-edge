import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1719300000000 implements MigrationInterface {
  name = 'InitialSchema1719300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE question_type_enum AS ENUM ('mcq', 'true_false', 'short_answer');
      CREATE TYPE difficulty_enum AS ENUM ('low', 'medium', 'high');
      CREATE TYPE student_session_status_enum AS ENUM ('NOT_LOGGED_IN', 'ACTIVE', 'OFFLINE', 'CHEATING', 'LOCKED', 'SUBMITTED');
      CREATE TYPE proctor_action_type_enum AS ENUM ('lock_exam', 'extend_time', 'force_submit', 'reset_session');
      CREATE TYPE audit_event_type_enum AS ENUM ('login', 'click', 'focus_lost', 'focus_violation', 'autosave', 'submit', 'proctor_action', 'fullscreen_exit');
    `);

    await queryRunner.query(`
      CREATE TABLE schools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        code VARCHAR,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE classes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        grade VARCHAR,
        school_id UUID REFERENCES schools(id)
      );

      CREATE TABLE students (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "fullName" VARCHAR NOT NULL,
        "studentCode" VARCHAR,
        combo_code VARCHAR,
        subject_group VARCHAR,
        school_id UUID REFERENCES schools(id),
        class_id UUID REFERENCES classes(id),
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE exam_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        routing_mode VARCHAR DEFAULT 'fixed_combo',
        rules JSONB DEFAULT '{}',
        start_at TIMESTAMPTZ,
        duration_min INT DEFAULT 90,
        status VARCHAR DEFAULT 'draft',
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE exam_papers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR NOT NULL,
        subject VARCHAR,
        combo_code VARCHAR,
        exam_session_id UUID REFERENCES exam_sessions(id),
        questions JSONB DEFAULT '[]',
        difficulty_meta JSONB DEFAULT '{}',
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE question_bank (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject VARCHAR NOT NULL,
        type question_type_enum NOT NULL,
        difficulty difficulty_enum DEFAULT 'medium',
        content JSONB NOT NULL,
        correct_key JSONB NOT NULL,
        max_score DECIMAL(5,2) DEFAULT 0.25,
        ui_mode VARCHAR,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE media_assets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        filename VARCHAR NOT NULL,
        path VARCHAR NOT NULL,
        "mimeType" VARCHAR NOT NULL,
        checksum VARCHAR,
        encrypted BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE student_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sbd VARCHAR NOT NULL,
        pin_hash VARCHAR NOT NULL,
        bound_ip VARCHAR,
        student_id UUID REFERENCES students(id),
        exam_session_id UUID REFERENCES exam_sessions(id) NOT NULL,
        exam_paper_id UUID REFERENCES exam_papers(id),
        status student_session_status_enum DEFAULT 'NOT_LOGGED_IN',
        answers JSONB DEFAULT '{}',
        violations JSONB DEFAULT '{"count":0,"events":[]}',
        time_extension_min INT DEFAULT 0,
        locked BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMPTZ,
        "scoreResult" JSONB,
        last_heartbeat TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_session_id UUID,
        student_session_id UUID,
        "eventType" audit_event_type_enum NOT NULL,
        payload JSONB DEFAULT '{}',
        ip VARCHAR,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_audit_session ON audit_logs(exam_session_id, "createdAt");

      CREATE TABLE proctor_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_session_id UUID NOT NULL,
        student_session_id UUID NOT NULL,
        "actionType" proctor_action_type_enum NOT NULL,
        payload JSONB DEFAULT '{}',
        "proctorId" VARCHAR,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE anonymization_map (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID NOT NULL,
        exam_session_id UUID NOT NULL,
        hash_code VARCHAR NOT NULL UNIQUE,
        revealed_at TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE grading_flags (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_session_id UUID NOT NULL,
        question_id VARCHAR NOT NULL,
        student_answer TEXT NOT NULL,
        reason VARCHAR DEFAULT 'format_mismatch',
        status VARCHAR DEFAULT 'pending',
        reviewed_score DECIMAL(5,2),
        reviewed_by VARCHAR,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE difficulty_stats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        question_id VARCHAR NOT NULL UNIQUE,
        difficulty difficulty_enum NOT NULL,
        total_attempts INT DEFAULT 0,
        correct_count INT DEFAULT 0,
        correct_rate DECIMAL(5,4) DEFAULT 0,
        calibration_alert BOOLEAN DEFAULT FALSE,
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS difficulty_stats, grading_flags, anonymization_map,
        proctor_actions, audit_logs, student_sessions, media_assets,
        question_bank, exam_papers, exam_sessions, students, classes, schools;
      DROP TYPE IF EXISTS audit_event_type_enum, proctor_action_type_enum,
        student_session_status_enum, difficulty_enum, question_type_enum;
    `);
  }
}
