import type { ExamRules } from './index';

export const EXAM_PACKAGE_FORMAT_VERSION = '1.2';

export interface ExamPackageMediaEntry {
  path: string;
  checksum: string;
  mimeType: string;
}

export interface ExamBranding {
  soGdName: string;
  schoolName: string;
  logoPath?: string;
  /** Địa danh trên văn bản hành chính (vd. Cà Mau) */
  placeName?: string;
  /** Tên ban coi thi (tuỳ chọn) */
  examBoardName?: string;
}

export interface ExamPackageManifest {
  formatVersion: string;
  packageId: string;
  examName: string;
  createdAt: string;
  mediaManifest: ExamPackageMediaEntry[];
  branding?: ExamBranding;
  /** `full` = một ZIP tất cả môn; `single_subject` = một ZIP / một môn (cùng packageId) */
  exportScope?: 'full' | 'single_subject';
  /** Môn trong gói khi exportScope = single_subject */
  subjectCode?: string;
}

/** v1.2: một tài khoản / thí sinh; có thể nhiều dòng nếu HS đăng ký nhiều môn (cùng examAccount). */
export interface ExamPackageCredentialRow {
  studentCode: string;
  fullName: string;
  className?: string;
  subjectCode: string;
  sbd: string;
  examAccount: string;
  pin: string;
  labRoom?: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface ExamPackageSessionConfig {
  name: string;
  routingMode: string;
  status: string;
  durationMin?: number;
  startAt?: string;
  rules: ExamRules;
  /** Nhãn phòng thi — hiển thị verbatim trên VBHC; phòng đầu khi xếp SBD */
  labRoomLabel?: string;
  /** Sức chứa mỗi phòng máy (mặc định 30) */
  labRoomCapacity?: number;
}

export interface ExamPackageSubjectRow {
  code: string;
  nameVi: string;
  examDate: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  structureMode: 'default' | 'custom';
  ui_mode: 'split_view' | 'vertical_focus';
}

export interface ExamPackageStudentRow {
  fullName: string;
  studentCode: string;
  className?: string;
  subjects: string[];
  note?: string;
  /** Ngày sinh (dd/mm/yyyy hoặc yyyy-mm-dd) */
  dateOfBirth?: string;
  /** Giới tính: Nam / Nữ */
  gender?: string;
  /** Gán tại Composer trước khi xuất ZIP */
  sbd?: string;
  pin?: string;
  labRoom?: string;
  comboCode?: string;
}

export interface ExamPackageClusterRow {
  id: string;
  subject: string;
  clusterSubtype: string;
  passage: Record<string, unknown>;
  questionIds: string[];
  difficulty?: string;
}

export interface ExamPackageQuestionRow {
  id: string;
  subject: string;
  type: string;
  difficulty: string;
  content: Record<string, unknown>;
  correctKey: unknown;
  maxScore?: number;
  uiMode?: string;
  clusterId?: string | null;
  clusterOrder?: number | null;
  /** Tin học Phần II: slot 1–6 */
  informaticsSlot?: number;
}

export interface ExamPackagePaperRow {
  title: string;
  subject: string;
  comboCode?: string;
  questions: Record<string, unknown>[];
  difficultyMeta?: Record<string, unknown>;
}

export interface ExamPackageExportState {
  manifest: ExamPackageManifest;
  session: ExamPackageSessionConfig;
  subjects: ExamPackageSubjectRow[];
  students: ExamPackageStudentRow[];
  /** v1.2: một dòng / môn đăng ký; cùng HS dùng chung examAccount + PIN */
  credentials?: ExamPackageCredentialRow[];
  clusters: ExamPackageClusterRow[];
  papers: Record<string, ExamPackagePaperRow>;
  mediaFiles?: Array<{ path: string; base64: string; mimeType: string }>;
  /** ISO timestamp — đã xếp SBD/PIN trong Composer */
  credentialsAssignedAt?: string;
  /** ISO timestamp — đã in phiếu trong Composer (bắt buộc trước xuất ZIP) */
  credentialsPrintedAt?: string;
}

export interface ExamPackageImportResult {
  examSessionId: string;
  packageId: string;
  exportScope?: 'full' | 'single_subject';
  subjectCode?: string;
  importedSubjects?: string[];
  pendingSubjects?: string[];
  students: { created: number; updated: number };
  slots: { created: number; updated: number; removed: number };
  papers: { created: number; updated: number };
  media: { imported: number };
  sessionUpdated: boolean;
  errors: Array<{ message: string; file?: string }>;
}

export interface ExamPackageValidateResult {
  valid: boolean;
  manifest?: ExamPackageManifest;
  errors: string[];
  warnings: string[];
}

/** Merge cluster passage/subtype into English cluster_mcq rows (preview / export). */
export function injectClusterPassages(
  questions: ExamPackageQuestionRow[],
  clusters: ExamPackageClusterRow[],
): ExamPackageQuestionRow[] {
  const byId = new Map(clusters.map((c) => [c.id, c]));
  return questions.map((q) => {
    const cid = q.clusterId;
    if (!cid || !byId.has(cid)) return q;
    const cluster = byId.get(cid)!;
    const passageText =
      (cluster.passage as { text?: string })?.text ??
      (cluster.passage as { body?: string })?.body ??
      '';
    const instruction =
      (cluster.passage as { instruction?: string })?.instruction ??
      (cluster.passage as { title?: string })?.title ??
      '';
    return {
      ...q,
      clusterSubtype: cluster.clusterSubtype,
      content: {
        ...q.content,
        passage: cluster.clusterSubtype === 'reorder' ? undefined : passageText || undefined,
        instruction: instruction || undefined,
        subtype: cluster.clusterSubtype,
      },
    } as ExamPackageQuestionRow & { clusterSubtype?: string };
  });
}

/** Gán nhãn phòng verbatim; tăng nhóm số cuối khi vượt capacity (01→02). */
export function assignLabRoomLabel(index: number, label?: string, capacity = 30): string {
  const base = (label?.trim() || '01');
  const roomIndex = Math.floor(index / capacity);
  if (roomIndex === 0) return base;

  const m = /^(.*?)(\d+)$/.exec(base);
  if (m) {
    const width = m[2].length;
    const next = parseInt(m[2], 10) + roomIndex;
    return `${m[1]}${String(next).padStart(width, '0')}`;
  }
  return `${base} — ${roomIndex + 1}`;
}
