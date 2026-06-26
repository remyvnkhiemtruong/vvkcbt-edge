import { ExamType, RoutingMode } from './index';

/** Cấu hình định tuyến môn thi — lưu trong exam_sessions.routing_config (JSONB) */
export interface SubjectRoutingConfig {
  mode: RoutingMode;
  /** TN THPT 2025: map combo_code → exam_paper_id */
  combo_map?: Record<string, string>;
  /** GDPT 2018 / kiểm tra định kỳ: map subject_group → exam_paper_id */
  subject_map?: Record<string, string>;
  /** Fallback khi không khớp map */
  default_paper_id?: string;
  /** Ưu tiên tra cứu: combo | subject_group | grade_stream */
  resolve_order?: Array<'combo_code' | 'subject_group' | 'grade_stream'>;
}

/** Một luồng/ban môn GDPT 2018 trong ca thi */
export interface GdptStreamConfig {
  stream_code: string;
  stream_name: string;
  grade: '10' | '11' | '12';
  subject_codes: string[];
  /** Khung giờ thi riêng cho luồng (phút từ start_at ca thi) */
  time_offset_min?: number;
  duration_min?: number;
  ui_mode?: 'split_view' | 'vertical_focus';
}

export interface ExamRulesRoutingSection {
  exam_type: ExamType;
  gdpt_streams?: GdptStreamConfig[];
}
