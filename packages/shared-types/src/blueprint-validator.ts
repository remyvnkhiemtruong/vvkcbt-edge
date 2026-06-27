import type {
  ExamPackageClusterRow,
  ExamPackageMediaEntry,
  ExamPackagePaperRow,
  ExamPackageQuestionRow,
} from './exam-package';
import type { TnThptSubjectCode } from './tn-thpt-catalog';
import { getDefaultStructure, getSubjectNameVi } from './tn-thpt-catalog';
import { isValidShortAnswer } from './short-answer';

export interface BlueprintValidationInput {
  subjectCode: string;
  paper: ExamPackagePaperRow;
  clusters?: ExamPackageClusterRow[];
  mediaManifest?: ExamPackageMediaEntry[];
}

export interface BlueprintValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type PaperQuestion = {
  id?: string;
  type?: string;
  part?: string;
  maxScore?: number;
  correctKey?: unknown;
  content?: Record<string, unknown>;
  clusterId?: string | null;
  clusterOrder?: number | null;
  informaticsSlot?: number;
};

const MEDIA_TOKEN_RE = /\[(?:Ảnh|Audio):\s*([^\]]+)\]/g;

function extractMediaFromText(text: string, paths: Set<string>) {
  for (const m of text.matchAll(MEDIA_TOKEN_RE)) {
    paths.add(m[1].trim());
  }
}

function collectMediaTokens(
  questions: PaperQuestion[],
  clusters?: ExamPackageClusterRow[],
): string[] {
  const paths = new Set<string>();
  for (const q of questions) {
    const stem = q.content?.stem;
    if (typeof stem === 'string') extractMediaFromText(stem, paths);
    const passage = q.content?.passage;
    if (typeof passage === 'string') extractMediaFromText(passage, paths);
    const options = q.content?.options;
    if (Array.isArray(options)) {
      for (const o of options) {
        if (typeof o === 'string') extractMediaFromText(o, paths);
      }
    }
    const statements = q.content?.statements;
    if (Array.isArray(statements)) {
      for (const s of statements) {
        if (typeof s === 'string') extractMediaFromText(s, paths);
      }
    }
  }
  for (const c of clusters ?? []) {
    const text = (c.passage as { text?: string })?.text;
    const body = (c.passage as { body?: string })?.body;
    if (typeof text === 'string') extractMediaFromText(text, paths);
    if (typeof body === 'string') extractMediaFromText(body, paths);
  }
  return [...paths];
}

function questionsByType(questions: PaperQuestion[], type: string): PaperQuestion[] {
  return questions.filter((q) => q.type === type);
}

function questionsByPart(questions: PaperQuestion[], part: string): PaperQuestion[] {
  return questions.filter((q) => q.part === part);
}

function isBooleanArray4(v: unknown): v is boolean[] {
  return Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'boolean');
}

/** Phần II Tin học: tối đa 4đ trên bài thi (câu 1–2 + một nhánh 2 câu), dù ngân hàng có 6 câu. */
export const INFORMATICS_PART2_EXAM_MAX = 4;

export function sumInformaticsExamMaxScore(questions: PaperQuestion[]): number {
  let part1 = 0;
  for (const q of questions) {
    if (q.part === 'part1_mcq') part1 += Number(q.maxScore) || 0.25;
  }
  return part1 + INFORMATICS_PART2_EXAM_MAX;
}

function sumMaxScore(questions: PaperQuestion[]): number {
  return questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0);
}

function validateTotalScore(
  subjectCode: string,
  questions: PaperQuestion[],
  nameVi: string,
  errors: string[],
) {
  const score =
    subjectCode === 'INFORMATICS'
      ? sumInformaticsExamMaxScore(questions)
      : sumMaxScore(questions);
  if (Math.abs(score - 10) > 0.01) {
    const raw = sumMaxScore(questions);
    errors.push(
      subjectCode === 'INFORMATICS'
        ? `${nameVi}: tổng điểm bài thi phải = 10 (Phần I + 4đ Phần II), hiện ${score} (tổng maxScore câu: ${raw})`
        : `${nameVi}: tổng điểm phải = 10, hiện ${score}`,
    );
  }
  if (subjectCode === 'INFORMATICS') {
    for (const q of questions) {
      if (
        q.part === 'part2_true_false' &&
        q.type === 'true_false' &&
        q.maxScore != null &&
        Math.abs(Number(q.maxScore) - 1) > 0.01
      ) {
        errors.push(
          `${nameVi}: câu TF Phần II ${q.id ?? '?'} phải có maxScore = 1, hiện ${q.maxScore}`,
        );
      }
    }
  }
}

export function validateSubjectBlueprint(input: BlueprintValidationInput): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const subjectCode = input.subjectCode as TnThptSubjectCode;
  const nameVi = getSubjectNameVi(subjectCode);
  const structure = getDefaultStructure(subjectCode);

  if (!structure) {
    return { valid: false, errors: [`Không có cấu trúc đề mặc định cho môn ${subjectCode}`], warnings };
  }

  const questions = (input.paper?.questions ?? []) as PaperQuestion[];
  if (!questions.length) {
    return { valid: false, errors: [`${nameVi}: đề trống`], warnings };
  }

  // Media token check
  const mediaPaths = collectMediaTokens(questions, input.clusters);
  const manifestPaths = new Set((input.mediaManifest ?? []).map((m) => m.path));
  for (const p of mediaPaths) {
    if (!manifestPaths.has(p) && !p.startsWith('media/')) {
      errors.push(`${nameVi}: token media "${p}" chưa có trong mediaManifest`);
    } else if (!manifestPaths.has(p) && p.startsWith('media/')) {
      errors.push(`${nameVi}: file media "${p}" chưa đăng ký trong gói`);
    }
  }

  if (subjectCode === 'ENGLISH') {
    const clusterMcq = questionsByType(questions, 'cluster_mcq');
    const expected = structure.parts.part1_cluster_mcq?.count ?? 40;
    if (clusterMcq.length !== expected) {
      errors.push(`${nameVi}: cần ${expected} câu cluster_mcq, có ${clusterMcq.length}`);
    }
    for (const q of clusterMcq) {
      if (!q.clusterId) errors.push(`${nameVi}: câu ${q.id ?? '?'} thiếu clusterId`);
      if (q.clusterOrder == null) warnings.push(`${nameVi}: câu ${q.id ?? '?'} thiếu clusterOrder`);
    }
    const clusters = input.clusters?.filter((c) => c.subject === 'ENGLISH') ?? [];
    const layout = structure.clusterLayout;
    if (layout) {
      for (const item of layout.clusters) {
        const matching = clusters.filter((c) => c.clusterSubtype === item.subtype);
        if (matching.length === 0) {
          errors.push(`${nameVi}: thiếu cluster subtype ${item.subtype}`);
        } else {
          const qCount = matching.reduce((n, c) => n + (c.questionIds?.length ?? 0), 0);
          if (qCount !== item.count) {
            errors.push(
              `${nameVi}: subtype ${item.subtype} cần ${item.count} câu, có ${qCount}`,
            );
          }
        }
      }
    }
    validateTotalScore(subjectCode, questions, nameVi, errors);
  } else {
    for (const [partKey, partCfg] of Object.entries(structure.parts)) {
      const partQuestions = questionsByPart(questions, partKey);
      const expectedCount = partCfg.count ?? (partCfg.type === 'essay' ? 1 : 0);
      if (partCfg.type === 'essay') continue;
      if (partQuestions.length !== expectedCount) {
        errors.push(
          `${nameVi}: ${partKey} cần ${expectedCount} câu ${partCfg.type}, có ${partQuestions.length}`,
        );
      }
      for (const q of partQuestions) {
        if (q.type !== partCfg.type) {
          errors.push(`${nameVi}: ${partKey} câu ${q.id ?? '?'} sai loại ${q.type} (cần ${partCfg.type})`);
        }
        if (partCfg.type === 'true_false' && !isBooleanArray4(q.correctKey)) {
          errors.push(`${nameVi}: câu TF ${q.id ?? '?'} correctKey phải là boolean[4]`);
        }
        if (partCfg.type === 'short_answer') {
          const key = String(q.correctKey ?? '').trim();
          if (!isValidShortAnswer(key)) {
            errors.push(
              `${nameVi}: câu trả lời ngắn ${q.id ?? '?'} — đáp án phải tối đa 4 ký tự (số âm/dương, thập phân, dấu chấm hoặc phẩy)`,
            );
          }
        }
      }
      if (subjectCode === 'INFORMATICS' && partKey === 'part2_true_false') {
        const slots = new Set<number>();
        for (const q of partQuestions) {
          const slot =
            q.informaticsSlot ??
            (typeof q.content?.informaticsSlot === 'number' ? q.content.informaticsSlot : undefined);
          if (slot == null) {
            warnings.push(
              `${nameVi}: câu TF ${q.id ?? '?'} thiếu informaticsSlot (sẽ suy từ thứ tự)`,
            );
            continue;
          }
          if (slot < 1 || slot > 6) {
            errors.push(`${nameVi}: câu TF ${q.id ?? '?'} informaticsSlot phải 1–6`);
          } else if (slots.has(slot)) {
            errors.push(`${nameVi}: informaticsSlot ${slot} bị trùng`);
          } else {
            slots.add(slot);
          }
        }
        if (partQuestions.length === 6) {
          for (let s = 1; s <= 6; s++) {
            if (!slots.has(s) && partQuestions.some((q) => q.informaticsSlot != null || q.content?.informaticsSlot != null)) {
              errors.push(`${nameVi}: thiếu informaticsSlot ${s}`);
            }
          }
        }
      }
    }
    validateTotalScore(subjectCode, questions, nameVi, errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAllSubjectBlueprints(
  papers: Record<string, ExamPackagePaperRow>,
  subjectCodes: string[],
  clusters?: ExamPackageClusterRow[],
  mediaManifest?: ExamPackageMediaEntry[],
): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const code of subjectCodes) {
    const paper = papers[code];
    if (!paper) {
      errors.push(`Thiếu đề môn ${getSubjectNameVi(code)} (${code})`);
      continue;
    }
    const r = validateSubjectBlueprint({
      subjectCode: code,
      paper,
      clusters,
      mediaManifest,
    });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { valid: errors.length === 0, errors, warnings };
}
