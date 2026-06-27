import type { PartScoreSummary } from './scoring';

export enum ExamType {
  TN_THPT_2025 = 'TN_THPT_2025',
  GDPT_2018 = 'GDPT_2018',
}

export enum RoutingMode {
  FIXED_COMBO = 'fixed_combo',
  DYNAMIC_SUBJECT = 'dynamic_subject',
}

export enum QuestionType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
  ESSAY = 'essay',
  CLUSTER_MCQ = 'cluster_mcq',
}

export enum Difficulty {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum StudentSessionStatus {
  NOT_LOGGED_IN = 'NOT_LOGGED_IN',
  ACTIVE = 'ACTIVE',
  OFFLINE = 'OFFLINE',
  CHEATING = 'CHEATING',
  LOCKED = 'LOCKED',
  SUBMITTED = 'SUBMITTED',
}

export enum ProctorActionType {
  LOCK_EXAM = 'lock_exam',
  EXTEND_TIME = 'extend_time',
  FORCE_SUBMIT = 'force_submit',
  RESET_SESSION = 'reset_session',
}

export enum AuditEventType {
  LOGIN = 'login',
  CLICK = 'click',
  FOCUS_LOST = 'focus_lost',
  FOCUS_VIOLATION = 'focus_violation',
  AUTOSAVE = 'autosave',
  SUBMIT = 'submit',
  EXAM_START = 'exam_start',
  PROCTOR_ACTION = 'proctor_action',
  SCORE_OVERRIDE = 'score_override',
  FULLSCREEN_EXIT = 'fullscreen_exit',
  HELP_REQUEST = 'help_request',
  APPEAL_CREATED = 'appeal_created',
  APPEAL_REVIEWED = 'appeal_reviewed',
}

export interface TrueFalseBranchScoring {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
}

export interface ExamRules {
  exam_type: ExamType;
  assessment_period?: 'GK1' | 'GK2' | 'CK1' | 'CK2';
  structure_template_id?: string;
  structure?: {
    source: 'QD764' | 'custom';
    is_custom: boolean;
    overrides?: Record<string, unknown>;
  };
  cognitive_distribution?: { nhan_biet: number; thong_hieu: number; van_dung: number };
  subjects: Array<{
    code: string;
    weight?: number;
    structureMode?: 'default' | 'custom';
    customTemplateId?: string;
    overrides?: Record<string, unknown>;
    parts?: string[];
    ui_mode?: 'split_view' | 'vertical_focus';
  }>;
  scoring: {
    true_false_branch: TrueFalseBranchScoring;
    short_answer_normalize: Array<'comma_to_dot' | 'trim_whitespace'>;
  };
  proctoring: {
    max_focus_violations: number;
    autosave_interval_sec: number;
    release_mode?: 'auto_at_time' | 'proctor_manual' | 'proctor_at_time';
    grace_before_min?: number;
    grace_after_min?: number;
    require_fullscreen?: boolean;
    block_copy_paste?: boolean;
    block_context_menu?: boolean;
    watermark?: boolean;
    single_active_session?: boolean;
  };
  audio?: {
    max_plays: number;
    seek_disabled: boolean;
  };
}

export interface ScoreBreakdownItem {
  questionId: string;
  type: QuestionType;
  score: number;
  maxScore: number;
  flagged?: boolean;
}

export interface SubmitResult {
  total: number;
  breakdown: ScoreBreakdownItem[];
  partScores?: PartScoreSummary;
  subject?: string;
  hasMoreSlots?: boolean;
  serverNow?: string;
  endsAt?: string;
  sbd?: string;
  examAccount?: string;
}

/** Tên trường mặc định — đồng bộ UI, biên bản, seed, Composer. */
export const DEFAULT_SCHOOL_NAME = 'THPT Võ Văn Kiệt';
export const DEFAULT_SCHOOL_CODE = 'VVK001';

export * from './scoring';
export * from './short-answer';
export * from './informatics-branch';
export * from './routing';
export * from './exam-structure';
export * from './tn-thpt-catalog';
export { TN_THPT_SUBJECTS, listTnThptSubjects, getSubjectMeta } from './tn-thpt-catalog';
export * from './exam-package';
export * from './question-content';
export * from './blueprint-validator';
export {
  BLUEPRINT_FIXTURES,
  buildValidEnglishClusters,
} from './__fixtures__/blueprint-fixtures';
export {
  seededShuffle,
  resolveQuestionPartKey,
  enrichQuestionsWithPart,
  orderQuestionsByPart,
  orderEnglishClusterQuestions,
  orderQuestionsForExam,
} from './question-order';
export type { EnglishClusterOrderQuestion } from './question-order';
