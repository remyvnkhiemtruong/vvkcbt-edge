import { resolveQuestionPartKey } from '@vnu/shared-types';
import type { ExamQuestion } from '../components/ExamViewShell';

export interface ExamPart {
  partKey: string;
  label: string;
  start: number;
  end: number;
  passage?: string;
  questionCount: number;
}

/** @deprecated Use ExamPart */
export type ExamCluster = ExamPart;

const PART_LABELS: Record<string, string> = {
  part1_mcq: 'Phần I',
  part2_true_false: 'Phần II',
  part3_short: 'Phần III',
  part1_reading: 'Phần I',
  part2_writing: 'Phần II',
  part1_cluster_mcq: 'Phần I',
};

export function getPartLabelVi(partKey: string): string {
  if (PART_LABELS[partKey]) return PART_LABELS[partKey];
  const m = partKey.match(/part(\d+)/i);
  if (m) return `Phần ${m[1]}`;
  return partKey.replace(/_/g, ' ');
}

export function getQuestionPassageText(q: ExamQuestion): string {
  const p =
    q.passage?.body ||
    q.content?.passage ||
    (typeof q.content?.body === 'string' ? q.content.body : '');
  return p?.trim() ?? '';
}

export function getQuestionInstruction(q: ExamQuestion | undefined): string {
  if (!q) return '';
  return (q.content?.instruction ?? q.passage?.title ?? '').trim();
}

function getViewGroupPassage(q: ExamQuestion): string {
  const fromPassage = getQuestionPassageText(q);
  if (fromPassage) return fromPassage;
  const stem = q.content?.stem;
  return typeof stem === 'string' ? stem.trim() : '';
}

function findPartPassage(questions: ExamQuestion[], start: number, end: number): string | undefined {
  for (let i = start; i <= end; i++) {
    const p = getQuestionPassageText(questions[i]);
    if (p) return p;
  }
  return undefined;
}

export interface ExamClusterRun {
  clusterId: string;
  subtype?: string;
  instruction: string;
  passage: string;
  questions: Array<{ q: ExamQuestion; globalIdx: number }>;
}

/** Nhóm hiển thị trên palette (theo cluster hoặc từng câu đơn). */
export interface ExamViewGroup {
  start: number;
  end: number;
  passage?: string;
  clusterId?: string;
}

export function isReorderClusterRun(run: ExamClusterRun): boolean {
  return run.subtype === 'reorder';
}

export function clusterRunHasContext(run: ExamClusterRun): boolean {
  if (isReorderClusterRun(run)) {
    return !!run.instruction?.trim();
  }
  return !!(run.instruction?.trim() || run.passage?.trim());
}

/** Đúng/sai, trả lời ngắn, TNKQ: tách đề bên trái, phần trả lời bên phải (chế độ ngang). */
export function shouldUseStemSplit(
  run: ExamClusterRun,
  uiMode: 'split_view' | 'vertical_focus',
): boolean {
  if (uiMode !== 'split_view') return false;
  if (clusterRunHasContext(run)) return false;
  const q = run.questions[0]?.q;
  if (!q) return false;
  const t = q.type ?? '';
  if (t === 'true_false' || t === 'short_answer' || t === 'mcq') return true;
  if (t === 'cluster_mcq') {
    const stem = q.content?.stem;
    return !!(getQuestionPassageText(q) || (typeof stem === 'string' && stem.trim()));
  }
  return false;
}

/**
 * Chế độ ngang: một câu mỗi lần (đề trái / đáp án phải);
 * câu chùm có đoạn văn: đoạn trái, toàn bộ câu trong chùm phải.
 */
export function getVisibleClusterRuns(
  runs: ExamClusterRun[],
  currentIdx: number,
  uiMode: 'split_view' | 'vertical_focus',
): ExamClusterRun[] {
  if (uiMode !== 'split_view' || runs.length === 0) return runs;

  const run = runs.find((r) => r.questions.some(({ globalIdx }) => globalIdx === currentIdx));
  if (!run) return runs;

  if (clusterRunHasContext(run)) {
    return [run];
  }

  const active = run.questions.filter(({ globalIdx }) => globalIdx === currentIdx);
  if (active.length === 0) return runs;
  return [{ ...run, questions: active }];
}

export function getExamViewRangeLabel(
  uiMode: 'split_view' | 'vertical_focus',
  currentIdx: number,
  part: ExamPart,
  questionNum: (n: number) => string,
): string {
  if (uiMode === 'split_view') {
    return questionNum(currentIdx + 1);
  }
  if (part.start === part.end) {
    return questionNum(part.start + 1);
  }
  return `Câu ${part.start + 1}–${part.end + 1}`;
}

/** Nhóm câu liên tiếp cùng cluster (cùng hướng dẫn / đoạn văn). */
export function buildClusterRuns(questions: ExamQuestion[], partStart: number, partEnd: number): ExamClusterRun[] {
  const runs: ExamClusterRun[] = [];
  let i = partStart;
  while (i <= partEnd) {
    const q = questions[i];
    const clusterId = q.clusterId ?? `solo-${i}`;
    const run: ExamClusterRun = {
      clusterId,
      subtype: q.clusterSubtype ?? q.content?.subtype,
      instruction: getQuestionInstruction(q),
      passage: getQuestionPassageText(q),
      questions: [{ q, globalIdx: i }],
    };
    i += 1;
    while (i <= partEnd) {
      const next = questions[i];
      const nextClusterId = next.clusterId ?? `solo-${i}`;
      if (nextClusterId !== clusterId) break;
      run.questions.push({ q: next, globalIdx: i });
      i += 1;
    }
    runs.push(run);
  }
  return runs;
}

/** Nhóm câu theo phần (partOrder từ structure); không tách theo passage. */
export function buildExamParts(questions: ExamQuestion[], partOrder?: string[]): ExamPart[] {
  if (questions.length === 0) return [];

  const runs: ExamPart[] = [];
  let i = 0;
  while (i < questions.length) {
    const partKey = resolveQuestionPartKey(questions[i]);
    const start = i;
    while (i + 1 < questions.length && resolveQuestionPartKey(questions[i + 1]) === partKey) {
      i++;
    }
    runs.push({
      partKey,
      label: getPartLabelVi(partKey),
      start,
      end: i,
      passage: findPartPassage(questions, start, i),
      questionCount: i - start + 1,
    });
    i++;
  }

  if (!partOrder?.length) return runs;

  const byKey = new Map(runs.map((p) => [p.partKey, p]));
  const ordered: ExamPart[] = [];
  const seen = new Set<string>();
  for (const key of partOrder) {
    const part = byKey.get(key);
    if (part) {
      ordered.push(part);
      seen.add(key);
    }
  }
  for (const part of runs) {
    if (!seen.has(part.partKey)) ordered.push(part);
  }
  return ordered;
}

/** @deprecated Use buildExamParts */
export function buildExamClusters(questions: ExamQuestion[], partOrder?: string[]): ExamPart[] {
  return buildExamParts(questions, partOrder);
}

/** Nhóm câu cho palette: liên tiếp cùng clusterId, hoặc mỗi câu đơn một nhóm. */
export function buildViewGroups(questions: ExamQuestion[]): ExamViewGroup[] {
  const groups: ExamViewGroup[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    const clusterId = q.clusterId;
    const start = i;
    if (clusterId) {
      i += 1;
      while (i < questions.length && questions[i].clusterId === clusterId) i += 1;
      const end = i - 1;
      groups.push({
        start,
        end,
        passage: findPartPassage(questions, start, end) || getViewGroupPassage(q) || undefined,
        clusterId,
      });
    } else {
      groups.push({
        start,
        end: start,
        passage: getViewGroupPassage(q) || undefined,
      });
      i += 1;
    }
  }
  return groups;
}

export function findViewGroupIndex(groups: ExamViewGroup[], questionIdx: number): number {
  return groups.findIndex((g) => questionIdx >= g.start && questionIdx <= g.end);
}

export function findPartIndex(parts: ExamPart[], questionIdx: number): number {
  return parts.findIndex((p) => questionIdx >= p.start && questionIdx <= p.end);
}

/** @deprecated Use findPartIndex */
export function findClusterIndex(clusters: ExamPart[], questionIdx: number): number {
  return findPartIndex(clusters, questionIdx);
}

export function isQuestionAnswered(answer: unknown): boolean {
  if (answer === undefined || answer === null || answer === '') return false;
  if (typeof answer === 'object' && !Array.isArray(answer) && Object.keys(answer as object).length === 0) {
    return false;
  }
  if (Array.isArray(answer)) {
    if (answer.length === 0) return false;
    return answer.some((v) => v === true || v === false);
  }
  return true;
}

export function countAnswered(
  questions: Array<{ id: string }>,
  answers: Record<string, unknown>,
): { answered: number; total: number; unanswered: number } {
  const total = questions.length;
  let answered = 0;
  for (const q of questions) {
    if (isQuestionAnswered(answers[q.id])) answered++;
  }
  return { answered, total, unanswered: total - answered };
}
