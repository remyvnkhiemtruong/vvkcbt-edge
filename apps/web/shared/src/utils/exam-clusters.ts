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

function findPartPassage(questions: ExamQuestion[], start: number, end: number): string | undefined {
  for (let i = start; i <= end; i++) {
    const p = getQuestionPassageText(questions[i]);
    if (p) return p;
  }
  return undefined;
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
