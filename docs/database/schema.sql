-- =============================================================================
-- VNU Edge Exam System — PostgreSQL Schema Reference
-- PostgreSQL 16+ | Extension: uuid-ossp
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- ENUM Types
-- -----------------------------------------------------------------------------

CREATE TYPE question_type_enum AS ENUM ('mcq', 'true_false', 'short_answer');
CREATE TYPE difficulty_enum AS ENUM ('low', 'medium', 'high');
CREATE TYPE student_session_status_enum AS ENUM (
  'NOT_LOGGED_IN', 'ACTIVE', 'OFFLINE', 'CHEATING', 'LOCKED', 'SUBMITTED'
);
CREATE TYPE proctor_action_type_enum AS ENUM (
  'lock_exam', 'extend_time', 'force_submit', 'reset_session'
);
CREATE TYPE audit_event_type_enum AS ENUM (
  'login', 'click', 'focus_lost', 'focus_violation',
  'autosave', 'submit', 'proctor_action', 'fullscreen_exit'
);

-- -----------------------------------------------------------------------------
-- Domain: Tổ chức
-- -----------------------------------------------------------------------------

CREATE TABLE schools (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR NOT NULL,
  code        VARCHAR,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR NOT NULL,
  grade      VARCHAR,                    -- '10', '11', '12'
  school_id  UUID REFERENCES schools(id) ON DELETE SET NULL
);

CREATE TABLE students (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "fullName"     VARCHAR NOT NULL,
  "studentCode"  VARCHAR,
  combo_code     VARCHAR,                -- TN THPT 2025: A00, B00, D01...
  subject_group  VARCHAR,                -- GDPT 2018: MATH, LITERATURE, BAN_TOAN_TIN...
  school_id      UUID REFERENCES schools(id) ON DELETE SET NULL,
  class_id       UUID REFERENCES classes(id) ON DELETE SET NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_combo ON students(combo_code) WHERE combo_code IS NOT NULL;
CREATE INDEX idx_students_subject_group ON students(subject_group) WHERE subject_group IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Domain: Ca thi & Định tuyến (JSONB trọng tâm)
-- -----------------------------------------------------------------------------

CREATE TABLE exam_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR NOT NULL,
  routing_mode    VARCHAR NOT NULL DEFAULT 'fixed_combo'
                    CHECK (routing_mode IN ('fixed_combo', 'dynamic_subject')),

  -- Luật chấm điểm, proctoring, UI (ExamRules)
  rules           JSONB NOT NULL DEFAULT '{}',

  -- Bộ định tuyến môn thi (SubjectRoutingConfig) — TÁCH KHỎI rules
  -- TN THPT: combo_map | GDPT: subject_map + gdpt_subject_streams
  routing_config  JSONB NOT NULL DEFAULT '{}',

  start_at        TIMESTAMPTZ,
  duration_min    INT NOT NULL DEFAULT 90,
  status          VARCHAR NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN exam_sessions.rules IS
  'JSONB: exam_type, subjects[], scoring, proctoring, audio. Không chứa map đề.';

COMMENT ON COLUMN exam_sessions.routing_config IS
  'JSONB: mode, combo_map, subject_map, resolve_order, default_paper_id.';

CREATE INDEX idx_exam_sessions_rules ON exam_sessions USING GIN (rules);
CREATE INDEX idx_exam_sessions_routing_config ON exam_sessions USING GIN (routing_config);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status) WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- Domain: Đề thi & Ngân hàng câu (trước gdpt_subject_streams vì FK)
-- -----------------------------------------------------------------------------

CREATE TABLE exam_papers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR NOT NULL,
  subject          VARCHAR,
  combo_code       VARCHAR,
  exam_session_id  UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
  questions        JSONB NOT NULL DEFAULT '[]',
  difficulty_meta  JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_papers_session ON exam_papers(exam_session_id);
CREATE INDEX idx_exam_papers_combo ON exam_papers(exam_session_id, combo_code);
CREATE INDEX idx_exam_papers_subject ON exam_papers(exam_session_id, subject);

-- GDPT 2018: Phân luồng ban môn / khối trong ca thi
CREATE TABLE gdpt_subject_streams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_session_id  UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  stream_code      VARCHAR NOT NULL,       -- BAN_TOAN_TIN_12
  stream_name      VARCHAR NOT NULL,       -- Ban Toán - Tin khối 12
  grade            VARCHAR NOT NULL DEFAULT '12',
  subject_codes    JSONB NOT NULL DEFAULT '[]',  -- ["MATH","INFORMATICS"]
  stream_config    JSONB NOT NULL DEFAULT '{}',  -- time_offset_min, duration_min, ui_mode
  exam_paper_id    UUID REFERENCES exam_papers(id) ON DELETE SET NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_session_id, stream_code)
);

COMMENT ON TABLE gdpt_subject_streams IS
  'Phân luồng ca thi GDPT 2018: mỗi ban/khối → đề riêng, khung giờ riêng.';

CREATE INDEX idx_gdpt_streams_session ON gdpt_subject_streams(exam_session_id);
CREATE INDEX idx_gdpt_streams_grade ON gdpt_subject_streams(grade);
CREATE INDEX idx_gdpt_streams_subject_codes ON gdpt_subject_streams USING GIN (subject_codes);

CREATE TABLE question_bank (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject      VARCHAR NOT NULL,
  type         question_type_enum NOT NULL,
  difficulty   difficulty_enum NOT NULL DEFAULT 'medium',
  content      JSONB NOT NULL,           -- stem, options, passage (KaTeX)
  correct_key  JSONB NOT NULL,           -- SERVER ONLY
  max_score    DECIMAL(5,2) NOT NULL DEFAULT 0.25,
  ui_mode      VARCHAR,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_bank_subject ON question_bank(subject);
CREATE INDEX idx_question_bank_content ON question_bank USING GIN (content);

CREATE TABLE media_assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename    VARCHAR NOT NULL,
  path        VARCHAR NOT NULL,
  "mimeType"  VARCHAR NOT NULL,
  checksum    VARCHAR,
  encrypted   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Domain: Phiên thi (Runtime)
-- -----------------------------------------------------------------------------

CREATE TABLE student_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sbd                 VARCHAR NOT NULL,
  pin_hash            VARCHAR NOT NULL,
  bound_ip            VARCHAR(45),
  student_id          UUID REFERENCES students(id) ON DELETE SET NULL,
  exam_session_id     UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_paper_id       UUID REFERENCES exam_papers(id) ON DELETE SET NULL,
  status              student_session_status_enum NOT NULL DEFAULT 'NOT_LOGGED_IN',
  answers             JSONB NOT NULL DEFAULT '{}',
  violations          JSONB NOT NULL DEFAULT '{"count":0,"events":[]}',
  time_extension_min  INT NOT NULL DEFAULT 0,
  locked              BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at        TIMESTAMPTZ,
  "scoreResult"       JSONB,
  last_heartbeat      TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_session_id, sbd)
);

CREATE INDEX idx_student_sessions_status ON student_sessions(exam_session_id, status);
CREATE INDEX idx_student_sessions_heartbeat ON student_sessions(last_heartbeat)
  WHERE status = 'ACTIVE';
CREATE INDEX idx_student_sessions_answers ON student_sessions USING GIN (answers);

-- -----------------------------------------------------------------------------
-- Domain: Audit Log (Vết lưu trữ)
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_session_id     UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  student_session_id  UUID REFERENCES student_sessions(id) ON DELETE SET NULL,
  "eventType"         audit_event_type_enum NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  ip                  VARCHAR(45),
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS
  'Ghi mọi sự kiện: login, click, focus, autosave, submit, proctor. Kèm IP vật lý.';

CREATE INDEX idx_audit_session ON audit_logs(exam_session_id, "createdAt" DESC);
CREATE INDEX idx_audit_student_session ON audit_logs(student_session_id, "createdAt" DESC);
CREATE INDEX idx_audit_event_type ON audit_logs("eventType", "createdAt" DESC);
CREATE INDEX idx_audit_payload ON audit_logs USING GIN (payload);
CREATE INDEX idx_audit_ip ON audit_logs(ip) WHERE ip IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Domain: Giám sát & Hậu kỳ
-- -----------------------------------------------------------------------------

CREATE TABLE proctor_actions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_session_id     UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_session_id  UUID NOT NULL REFERENCES student_sessions(id) ON DELETE CASCADE,
  "actionType"        proctor_action_type_enum NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  "proctorId"         VARCHAR,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE anonymization_map (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID NOT NULL,
  exam_session_id  UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  hash_code        VARCHAR NOT NULL UNIQUE,
  revealed_at      TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, exam_session_id)
);

CREATE TABLE grading_flags (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_session_id  UUID NOT NULL REFERENCES student_sessions(id) ON DELETE CASCADE,
  question_id         VARCHAR NOT NULL,
  student_answer      TEXT NOT NULL,
  reason              VARCHAR NOT NULL DEFAULT 'format_mismatch',
  status              VARCHAR NOT NULL DEFAULT 'pending',
  reviewed_score      DECIMAL(5,2),
  reviewed_by         VARCHAR,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE difficulty_stats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id       VARCHAR NOT NULL UNIQUE,
  difficulty        difficulty_enum NOT NULL,
  total_attempts    INT NOT NULL DEFAULT 0,
  correct_count     INT NOT NULL DEFAULT 0,
  correct_rate      DECIMAL(5,4) NOT NULL DEFAULT 0,
  calibration_alert BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- FK deferred: gdpt_subject_streams → exam_papers (exam_papers created above)
-- Re-add if creating fresh (already in CREATE TABLE)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Sample: routing_config TN THPT 2025
-- -----------------------------------------------------------------------------
/*
UPDATE exam_sessions SET routing_config = '{
  "mode": "fixed_combo",
  "resolve_order": ["combo_code"],
  "combo_map": {
    "A00": "<paper-uuid-toan-ly-hoa>",
    "D01": "<paper-uuid-van-su-dia>"
  }
}'::jsonb WHERE id = '<session-uuid>';
*/

-- -----------------------------------------------------------------------------
-- Sample: GDPT 2018 stream + routing
-- -----------------------------------------------------------------------------
/*
INSERT INTO exam_sessions (name, routing_mode, rules, routing_config, status) VALUES (
  'Kiểm tra GK1 Toán 12',
  'dynamic_subject',
  '{"exam_type":"GDPT_2018","subjects":[{"code":"MATH","weight":2,"ui_mode":"vertical_focus"}],
    "scoring":{"true_false_branch":{"1":0.1,"2":0.25,"3":0.5,"4":1.0},
    "short_answer_normalize":["comma_to_dot","trim_whitespace"]},
    "proctoring":{"max_focus_violations":3,"autosave_interval_sec":3}}',
  '{"mode":"dynamic_subject","resolve_order":["subject_group","grade_stream"],
    "subject_map":{"MATH":"<paper-uuid>"}}',
  'active'
);

INSERT INTO gdpt_subject_streams
  (exam_session_id, stream_code, stream_name, grade, subject_codes, stream_config, exam_paper_id)
VALUES
  ('<session-uuid>', 'BAN_TOAN_TIN_12', 'Ban Toán - Tin', '12',
   '["MATH","INFORMATICS"]',
   '{"time_offset_min":0,"duration_min":45,"ui_mode":"vertical_focus"}',
   '<paper-uuid>');
*/

-- -----------------------------------------------------------------------------
-- Query: Audit timeline thí sinh vi phạm
-- -----------------------------------------------------------------------------
/*
SELECT al."createdAt", al."eventType", al.ip, al.payload
FROM audit_logs al
WHERE al.student_session_id = '<session-uuid>'
  AND al."eventType" IN ('focus_violation', 'focus_lost', 'fullscreen_exit')
ORDER BY al."createdAt" DESC;
*/

-- -----------------------------------------------------------------------------
-- Query: Resolve đề GDPT theo subject_group
-- -----------------------------------------------------------------------------
/*
SELECT ep.*
FROM students s
JOIN gdpt_subject_streams gs
  ON gs.exam_session_id = '<session-uuid>'
  AND gs.grade = (SELECT grade FROM classes WHERE id = s.class_id)
  AND gs.subject_codes @> to_jsonb(ARRAY[s.subject_group])
JOIN exam_papers ep ON ep.id = gs.exam_paper_id
WHERE s.id = '<student-uuid>';
*/

-- =============================================================================
-- Migration 171950: QĐ 764 structure templates (TN THPT + GK/CK unified)
-- =============================================================================

ALTER TYPE question_type_enum ADD VALUE IF NOT EXISTS 'essay';
ALTER TYPE question_type_enum ADD VALUE IF NOT EXISTS 'cluster_mcq';

CREATE TYPE structure_source_enum AS ENUM ('QD764', 'custom');
CREATE TYPE gdpt_assessment_period_enum AS ENUM ('GK1', 'GK2', 'CK1', 'CK2');

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

CREATE TABLE question_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject VARCHAR NOT NULL DEFAULT 'ENGLISH',
  cluster_subtype VARCHAR NOT NULL,
  passage JSONB NOT NULL,
  question_ids JSONB NOT NULL DEFAULT '[]',
  difficulty difficulty_enum DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES question_clusters(id),
  ADD COLUMN IF NOT EXISTS cluster_order INT;

CREATE TABLE tnpt_combo_catalog (
  combo_code VARCHAR(4) PRIMARY KEY,
  combo_name VARCHAR NOT NULL,
  subjects JSONB NOT NULL,
  admission_blocks JSONB,
  active_from INT DEFAULT 2025
);

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

ALTER TABLE gdpt_subject_streams
  ADD COLUMN IF NOT EXISTS assessment_period gdpt_assessment_period_enum,
  ADD COLUMN IF NOT EXISTS structure_template_id UUID REFERENCES exam_structure_templates(id);
