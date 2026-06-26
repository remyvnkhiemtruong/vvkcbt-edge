import { StructureSource } from './exam-structure';
import type { ClusterLayoutItem, ExamPartConfig, ExamStructureTemplate } from './exam-structure';

export type SubjectStructureMode = 'default' | 'custom';

export type TnThptSubjectCode =
  | 'MATH'
  | 'ENGLISH'
  | 'PHYSICS'
  | 'CHEMISTRY'
  | 'BIOLOGY'
  | 'GEOGRAPHY'
  | 'HISTORY'
  | 'CIVIC_EDU'
  | 'TECHNOLOGY'
  | 'INFORMATICS';

export interface TnThptSubjectMeta {
  code: TnThptSubjectCode;
  nameVi: string;
  mandatory: boolean;
  durationMin: number;
  uiMode: 'split_view' | 'vertical_focus';
  templateCode: string;
}

const TF_BRANCH = { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 };
export const DEFAULT_COGNITIVE_DISTRIBUTION = { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 };

export const TN_THPT_SUBJECTS: TnThptSubjectMeta[] = [
  { code: 'MATH', nameVi: 'Toán', mandatory: true, durationMin: 90, uiMode: 'split_view', templateCode: 'MATH_QD764' },
  { code: 'ENGLISH', nameVi: 'Tiếng Anh', mandatory: false, durationMin: 50, uiMode: 'split_view', templateCode: 'ENGLISH_QD764' },
  { code: 'PHYSICS', nameVi: 'Vật lý', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'PHYSICS_QD764' },
  { code: 'CHEMISTRY', nameVi: 'Hóa học', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'CHEMISTRY_QD764' },
  { code: 'BIOLOGY', nameVi: 'Sinh học', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'BIOLOGY_QD764' },
  { code: 'GEOGRAPHY', nameVi: 'Địa lý', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'GEOGRAPHY_QD764' },
  { code: 'HISTORY', nameVi: 'Lịch sử', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'HISTORY_QD764' },
  { code: 'CIVIC_EDU', nameVi: 'GDKT&PL', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'CIVIC_EDU_QD764' },
  { code: 'TECHNOLOGY', nameVi: 'Công nghệ', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'TECHNOLOGY_QD764' },
  { code: 'INFORMATICS', nameVi: 'Tin học', mandatory: false, durationMin: 50, uiMode: 'vertical_focus', templateCode: 'INFORMATICS_QD764' },
];

export const QD764_DEFAULT_STRUCTURES: ExamStructureTemplate[] = [
  {
    code: 'MATH_QD764',
    subject: 'MATH',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 90,
    totalScore: 10,
    uiMode: 'split_view',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 12, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
      part3_short: { count: 6, score_per_item: 0.5, type: 'short_answer' },
    },
  },
  {
    code: 'PHYSICS_QD764',
    subject: 'PHYSICS',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 18, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
      part3_short: { count: 6, score_per_item: 0.25, type: 'short_answer' },
    },
  },
  {
    code: 'CHEMISTRY_QD764',
    subject: 'CHEMISTRY',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 18, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
      part3_short: { count: 6, score_per_item: 0.25, type: 'short_answer' },
    },
  },
  {
    code: 'BIOLOGY_QD764',
    subject: 'BIOLOGY',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 18, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
      part3_short: { count: 6, score_per_item: 0.25, type: 'short_answer' },
    },
  },
  {
    code: 'GEOGRAPHY_QD764',
    subject: 'GEOGRAPHY',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 18, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
      part3_short: { count: 6, score_per_item: 0.25, type: 'short_answer' },
    },
  },
  {
    code: 'HISTORY_QD764',
    subject: 'HISTORY',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 24, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
    },
  },
  {
    code: 'CIVIC_EDU_QD764',
    subject: 'CIVIC_EDU',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 24, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
    },
  },
  {
    code: 'TECHNOLOGY_QD764',
    subject: 'TECHNOLOGY',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 24, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 4, score_branch: TF_BRANCH, type: 'true_false' },
    },
  },
  {
    code: 'INFORMATICS_QD764',
    subject: 'INFORMATICS',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'vertical_focus',
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_mcq: { count: 24, score_per_item: 0.25, type: 'mcq' },
      part2_true_false: { count: 6, score_branch: TF_BRANCH, type: 'true_false' },
    },
  },
  {
    code: 'ENGLISH_QD764',
    subject: 'ENGLISH',
    source: StructureSource.QD764,
    isCustom: false,
    durationMin: 50,
    totalScore: 10,
    uiMode: 'split_view',
    shuffleWithinPart: false,
    cognitiveDistribution: DEFAULT_COGNITIVE_DISTRIBUTION,
    parts: {
      part1_cluster_mcq: { count: 40, score_per_item: 0.25, type: 'cluster_mcq' },
    },
    clusterLayout: {
      clusters: [
        { subtype: 'fill_notice', count: 6 },
        { subtype: 'fill_flyer', count: 6 },
        { subtype: 'reorder', count: 5 },
        { subtype: 'fill_gap', count: 5 },
        { subtype: 'reading_8', count: 8 },
        { subtype: 'reading_10', count: 10 },
      ] as ClusterLayoutItem[],
      total_mcq: 40,
    },
  },
];

const structureBySubject = new Map(
  QD764_DEFAULT_STRUCTURES.map((s) => [s.subject, s]),
);

const structureByCode = new Map(QD764_DEFAULT_STRUCTURES.map((s) => [s.code, s]));

export function listTnThptSubjects() {
  return TN_THPT_SUBJECTS.map((meta) => ({
    ...meta,
    defaultStructure: getDefaultStructure(meta.code),
  }));
}

export function getSubjectMeta(code: string): TnThptSubjectMeta | undefined {
  return TN_THPT_SUBJECTS.find((s) => s.code === code);
}

export function getDefaultStructure(subjectCode: string): ExamStructureTemplate | undefined {
  return structureBySubject.get(subjectCode);
}

export function getDefaultStructureByCode(templateCode: string): ExamStructureTemplate | undefined {
  return structureByCode.get(templateCode);
}

export function getSubjectNameVi(code: string): string {
  return getSubjectMeta(code)?.nameVi ?? code;
}

export function applyStructureOverrides(
  base: ExamStructureTemplate,
  overrides?: Record<string, unknown>,
): ExamStructureTemplate {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  const merged = { ...base, parts: { ...base.parts } };
  if (overrides.durationMin != null) merged.durationMin = Number(overrides.durationMin);
  if (overrides.uiMode != null) merged.uiMode = overrides.uiMode as ExamStructureTemplate['uiMode'];
  if (overrides.parts && typeof overrides.parts === 'object') {
    merged.parts = { ...merged.parts, ...(overrides.parts as Record<string, ExamPartConfig>) };
    for (const key of Object.keys(overrides.parts as object)) {
      if ((overrides.parts as Record<string, unknown>)[key] === null) {
        delete merged.parts[key];
      }
    }
  }
  return merged;
}

const STANDARD_PART_LABELS: Record<string, { title: string; subtitle?: string }> = {
  part1_mcq: { title: 'Phần I — Trắc nghiệm nhiều lựa chọn' },
  part2_true_false: {
    title: 'Phần II — Trắc nghiệm Đúng/Sai',
    subtitle: 'Mỗi câu 4 ý, chọn Đúng hoặc Sai',
  },
  part3_short: { title: 'Phần III — Trắc nghiệm trả lời ngắn' },
  part1_cluster_mcq: { title: 'Phần I — Trắc nghiệm' },
};

function resolvePartLabelMeta(
  subjectCode: string | undefined,
  partKey: string,
): { title: string; subtitle?: string } {
  const subject = (subjectCode || '').toUpperCase();
  if (subject === 'ENGLISH' && (partKey === 'part1_cluster_mcq' || partKey.startsWith('part1'))) {
    return STANDARD_PART_LABELS.part1_cluster_mcq;
  }
  if (subject === 'INFORMATICS' && partKey === 'part2_true_false') {
    return {
      title: 'Phần II — Trắc nghiệm Đúng/Sai',
      subtitle:
        'Câu 1–2: chung. Chọn một nhánh: câu 3–4 (Khoa học máy tính) hoặc câu 5–6 (Tin học ứng dụng). Không được làm lẫn hai nhánh.',
    };
  }
  if (STANDARD_PART_LABELS[partKey]) return STANDARD_PART_LABELS[partKey];
  const m = partKey.match(/part(\d+)/i);
  if (m) return { title: `Phần ${m[1]}` };
  return { title: partKey.replace(/_/g, ' ') };
}

/** Tiêu đề phần theo QĐ 764/QĐ-BGDĐT (theo môn). */
export function getPartLabelVi(subjectCode: string | undefined, partKey: string): string {
  return resolvePartLabelMeta(subjectCode, partKey).title;
}

/** Dòng phụ dưới tiêu đề phần (nếu có). */
export function getPartSubtitleVi(subjectCode: string | undefined, partKey: string): string | undefined {
  return resolvePartLabelMeta(subjectCode, partKey).subtitle;
}

/** 36 tổ hợp TN THPT 2025 theo QĐ 4068 */
export const TNPT_36_COMBOS: Array<{
  comboCode: string;
  comboName: string;
  subjects: string[];
  admissionBlocks: string[];
}> = [
  { comboCode: 'A00', comboName: 'Toán, Lý, Hóa, Sinh', subjects: ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'], admissionBlocks: ['A00'] },
  { comboCode: 'A01', comboName: 'Toán, Lý, Hóa, Anh', subjects: ['MATH', 'PHYSICS', 'CHEMISTRY', 'ENGLISH'], admissionBlocks: ['A01'] },
  { comboCode: 'A02', comboName: 'Toán, Lý, Sinh, Anh', subjects: ['MATH', 'PHYSICS', 'BIOLOGY', 'ENGLISH'], admissionBlocks: ['A02'] },
  { comboCode: 'A03', comboName: 'Toán, Hóa, Sinh, Anh', subjects: ['MATH', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH'], admissionBlocks: ['A03'] },
  { comboCode: 'A04', comboName: 'Toán, Lý, Hóa, Địa', subjects: ['MATH', 'PHYSICS', 'CHEMISTRY', 'GEOGRAPHY'], admissionBlocks: ['A04'] },
  { comboCode: 'A05', comboName: 'Toán, Lý, Sinh, Địa', subjects: ['MATH', 'PHYSICS', 'BIOLOGY', 'GEOGRAPHY'], admissionBlocks: ['A05'] },
  { comboCode: 'A06', comboName: 'Toán, Hóa, Sinh, Địa', subjects: ['MATH', 'CHEMISTRY', 'BIOLOGY', 'GEOGRAPHY'], admissionBlocks: ['A06'] },
  { comboCode: 'A07', comboName: 'Toán, Lý, Hóa, Sử', subjects: ['MATH', 'PHYSICS', 'CHEMISTRY', 'HISTORY'], admissionBlocks: ['A07'] },
  { comboCode: 'A08', comboName: 'Toán, Lý, Sinh, Sử', subjects: ['MATH', 'PHYSICS', 'BIOLOGY', 'HISTORY'], admissionBlocks: ['A08'] },
  { comboCode: 'A09', comboName: 'Toán, Hóa, Sinh, Sử', subjects: ['MATH', 'CHEMISTRY', 'BIOLOGY', 'HISTORY'], admissionBlocks: ['A09'] },
  { comboCode: 'A10', comboName: 'Toán, Lý, Địa, Anh', subjects: ['MATH', 'PHYSICS', 'GEOGRAPHY', 'ENGLISH'], admissionBlocks: ['A10'] },
  { comboCode: 'A11', comboName: 'Toán, Hóa, Địa, Anh', subjects: ['MATH', 'CHEMISTRY', 'GEOGRAPHY', 'ENGLISH'], admissionBlocks: ['A11'] },
  { comboCode: 'A12', comboName: 'Toán, Sinh, Địa, Anh', subjects: ['MATH', 'BIOLOGY', 'GEOGRAPHY', 'ENGLISH'], admissionBlocks: ['A12'] },
  { comboCode: 'A14', comboName: 'Toán, Lý, Sử, Anh', subjects: ['MATH', 'PHYSICS', 'HISTORY', 'ENGLISH'], admissionBlocks: ['A14'] },
  { comboCode: 'A15', comboName: 'Toán, Hóa, Sử, Anh', subjects: ['MATH', 'CHEMISTRY', 'HISTORY', 'ENGLISH'], admissionBlocks: ['A15'] },
  { comboCode: 'A16', comboName: 'Toán, Sinh, Sử, Anh', subjects: ['MATH', 'BIOLOGY', 'HISTORY', 'ENGLISH'], admissionBlocks: ['A16'] },
  { comboCode: 'B00', comboName: 'Toán, Lý, Hóa, Tin', subjects: ['MATH', 'PHYSICS', 'CHEMISTRY', 'INFORMATICS'], admissionBlocks: ['B00'] },
  { comboCode: 'B01', comboName: 'Toán, Lý, Sinh, Tin', subjects: ['MATH', 'PHYSICS', 'BIOLOGY', 'INFORMATICS'], admissionBlocks: ['B01'] },
  { comboCode: 'B03', comboName: 'Toán, Hóa, Sinh, Tin', subjects: ['MATH', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS'], admissionBlocks: ['B03'] },
  { comboCode: 'B04', comboName: 'Toán, Lý, Địa, Tin', subjects: ['MATH', 'PHYSICS', 'GEOGRAPHY', 'INFORMATICS'], admissionBlocks: ['B04'] },
  { comboCode: 'B05', comboName: 'Toán, Lý, Sử, Tin', subjects: ['MATH', 'PHYSICS', 'HISTORY', 'INFORMATICS'], admissionBlocks: ['B05'] },
  { comboCode: 'B08', comboName: 'Toán, Sinh, Địa, Tin', subjects: ['MATH', 'BIOLOGY', 'GEOGRAPHY', 'INFORMATICS'], admissionBlocks: ['B08'] },
  { comboCode: 'C00', comboName: 'Sử, Địa, GDKT&PL', subjects: ['MATH', 'HISTORY', 'GEOGRAPHY', 'CIVIC_EDU'], admissionBlocks: ['C00'] },
  { comboCode: 'C01', comboName: 'Sử, Địa, Anh', subjects: ['MATH', 'HISTORY', 'GEOGRAPHY', 'ENGLISH'], admissionBlocks: ['C01'] },
  { comboCode: 'C02', comboName: 'Sử, GDKT&PL, Anh', subjects: ['MATH', 'HISTORY', 'CIVIC_EDU', 'ENGLISH'], admissionBlocks: ['C02'] },
  { comboCode: 'C03', comboName: 'Địa, GDKT&PL, Anh', subjects: ['MATH', 'GEOGRAPHY', 'CIVIC_EDU', 'ENGLISH'], admissionBlocks: ['C03'] },
  { comboCode: 'C04', comboName: 'Sử, Địa, Tin', subjects: ['MATH', 'HISTORY', 'GEOGRAPHY', 'INFORMATICS'], admissionBlocks: ['C04'] },
  { comboCode: 'C05', comboName: 'Sử, GDKT&PL, Tin', subjects: ['MATH', 'HISTORY', 'CIVIC_EDU', 'INFORMATICS'], admissionBlocks: ['C05'] },
  { comboCode: 'C06', comboName: 'Địa, GDKT&PL, Tin', subjects: ['MATH', 'GEOGRAPHY', 'CIVIC_EDU', 'INFORMATICS'], admissionBlocks: ['C06'] },
  { comboCode: 'C07', comboName: 'Sử, Địa, Công nghệ', subjects: ['MATH', 'HISTORY', 'GEOGRAPHY', 'TECHNOLOGY'], admissionBlocks: ['C07'] },
  { comboCode: 'C08', comboName: 'Sử, GDKT&PL, CN', subjects: ['MATH', 'HISTORY', 'CIVIC_EDU', 'TECHNOLOGY'], admissionBlocks: ['C08'] },
  { comboCode: 'C09', comboName: 'Địa, GDKT&PL, CN', subjects: ['MATH', 'GEOGRAPHY', 'CIVIC_EDU', 'TECHNOLOGY'], admissionBlocks: ['C09'] },
  { comboCode: 'C10', comboName: 'Sử, Địa, Anh (C10)', subjects: ['MATH', 'HISTORY', 'GEOGRAPHY', 'ENGLISH'], admissionBlocks: ['C10'] },
  { comboCode: 'D01', comboName: 'Toán, Anh, Tin', subjects: ['MATH', 'ENGLISH', 'INFORMATICS'], admissionBlocks: ['D01'] },
  { comboCode: 'D07', comboName: 'Toán, Anh, GDKT&PL', subjects: ['MATH', 'ENGLISH', 'CIVIC_EDU'], admissionBlocks: ['D07'] },
  { comboCode: 'D14', comboName: 'Toán, Anh, Công nghệ', subjects: ['MATH', 'ENGLISH', 'TECHNOLOGY'], admissionBlocks: ['D14'] },
  { comboCode: 'D15', comboName: 'Toán, Sử, Anh', subjects: ['MATH', 'HISTORY', 'ENGLISH'], admissionBlocks: ['D15'] },
];
