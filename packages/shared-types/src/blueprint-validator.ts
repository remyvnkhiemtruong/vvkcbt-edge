import type {
  ExamPackageClusterRow,
  ExamPackageMediaEntry,
  ExamPackagePaperRow,
} from './exam-package';
import type { TnThptSubjectCode } from './tn-thpt-catalog';
import { getDefaultStructure, getSubjectNameVi } from './tn-thpt-catalog';

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
};

const MEDIA_TOKEN_RE = /\[(?:Ảnh|Audio):\s*([^\]]+)\]/g;

function collectMediaTokens(questions: PaperQuestion[]): string[] {
  const paths = new Set<string>();
  for (const q of questions) {
    const texts: string[] = [];
    const stem = q.content?.stem;
    if (typeof stem === 'string') texts.push(stem);
    const passage = q.content?.passage;
    if (typeof passage === 'string') texts.push(passage);
    for (const t of texts) {
      for (const m of t.matchAll(MEDIA_TOKEN_RE)) {
        paths.add(m[1].trim());
      }
    }
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

function sumMaxScore(questions: PaperQuestion[]): number {
  return questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0);
}

export function validateSubjectBlueprint(input: BlueprintValidationInput): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const subjectCode = input.subjectCode as TnThptSubjectCode;
  const nameVi = getSubjectNameVi(subjectCode);
  const structure = getDefaultStructure(subjectCode);

  if (!structure) {
    return { valid: false, errors: [`Không có cấu trúc QĐ764 cho môn ${subjectCode}`], warnings };
  }

  const questions = (input.paper?.questions ?? []) as PaperQuestion[];
  if (!questions.length) {
    return { valid: false, errors: [`${nameVi}: đề trống`], warnings };
  }

  // Media token check
  const mediaPaths = collectMediaTokens(questions);
  const manifestPaths = new Set((input.mediaManifest ?? []).map((m) => m.path));
  for (const p of mediaPaths) {
    if (!manifestPaths.has(p) && !p.startsWith('media/')) {
      errors.push(`${nameVi}: token media "${p}" chưa có trong mediaManifest`);
    } else if (!manifestPaths.has(p) && p.startsWith('media/')) {
      errors.push(`${nameVi}: file media "${p}" chưa đăng ký trong gói`);
    }
  }

  if (subjectCode === 'LITERATURE') {
    const essays = questionsByType(questions, 'essay');
    if (essays.length !== 2) {
      errors.push(`${nameVi}: cần đúng 2 câu tự luận (đọc hiểu + nghị luận), có ${essays.length}`);
    }
    const p1 = questionsByPart(questions, 'part1_reading');
    const p2 = questionsByPart(questions, 'part2_writing');
    if (p1.length !== 1) errors.push(`${nameVi}: Phần I đọc hiểu cần 1 câu, có ${p1.length}`);
    if (p2.length !== 1) errors.push(`${nameVi}: Phần II nghị luận cần 1 câu, có ${p2.length}`);
    const score = sumMaxScore(questions);
    if (Math.abs(score - 10) > 0.01) {
      errors.push(`${nameVi}: tổng điểm phải = 10, hiện ${score}`);
    }
  } else if (subjectCode === 'ENGLISH') {
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
    const score = sumMaxScore(questions);
    if (Math.abs(score - 10) > 0.01) {
      errors.push(`${nameVi}: tổng điểm phải = 10, hiện ${score}`);
    }
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
      }
    }
    const score = sumMaxScore(questions);
    if (Math.abs(score - 10) > 0.01) {
      errors.push(`${nameVi}: tổng điểm phải = 10, hiện ${score}`);
    }
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
