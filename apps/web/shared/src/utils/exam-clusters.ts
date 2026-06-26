import { getPartLabelVi as catalogPartLabel, getPartSubtitleVi } from '@vnu/shared-types';
import { resolveQuestionPartKey } from '@vnu/shared-types';
import type { ExamQuestion } from '../components/ExamViewShell';

export interface ExamPart {
  partKey: string;
  label: string;
  subtitle?: string;
  start: number;
  end: number;
  passage?: string;
  questionCount: number;
}

/** @deprecated Use ExamPart */
export type ExamCluster = ExamPart;

/** Một “màn” hiển thị: 1 câu hoặc 1 chùm (Tiếng Anh). */
export interface ExamViewGroup {
  start: number;
  end: number;
  passage?: string;
}

function isSameClusterGroup(a: ExamQuestion, b: ExamQuestion): boolean {
  if (a.type !== 'cluster_mcq' || b.type !== 'cluster_mcq') return false;
  if (a.clusterId && b.clusterId) return a.clusterId === b.clusterId;
  const pa = getQuestionPassageText(a);
  const pb = getQuestionPassageText(b);
  return !!pa && pa === pb;
}

/** Nhóm câu cho hiển thị — từng câu riêng, hoặc chùm cluster_mcq liên tiếp. */
export function buildViewGroups(questions: ExamQuestion[]): ExamViewGroup[] {
  if (questions.length === 0) return [];

  const groups: ExamViewGroup[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    if (q.type === 'cluster_mcq') {
      const start = i;
      while (i + 1 < questions.length && isSameClusterGroup(q, questions[i + 1])) {
        i++;
      }
      groups.push({
        start,
        end: i,
        passage: getQuestionPassageText(q) || undefined,
      });
      i++;
      continue;
    }
    groups.push({
      start: i,
      end: i,
      passage: getSplitPaneText(q) || undefined,
    });
    i++;
  }
  return groups;
}

export function findViewGroupIndex(groups: ExamViewGroup[], questionIdx: number): number {
  const idx = groups.findIndex((g) => questionIdx >= g.start && questionIdx <= g.end);
  return idx >= 0 ? idx : 0;
}

export function getPartLabelVi(partKey: string, subjectCode?: string): string {
  return catalogPartLabel(subjectCode, partKey);
}

export function getQuestionPassageText(q: ExamQuestion): string {
  const p =
    q.passage?.body ||
    q.content?.passage ||
    (typeof q.content?.body === 'string' ? q.content.body : '');
  return p?.trim() ?? '';
}

/** Văn bản hiển thị cột trái (split_view): đề bài Đ/S hoặc passage. */
export function getSplitPaneText(q: ExamQuestion): string {
  if (q.type === 'true_false') {
    const stem = q.content?.stem?.trim();
    if (stem) return stem;
  }
  if (q.type === 'short_answer') {
    const stem = q.content?.stem?.trim();
    if (stem) return stem;
  }
  return getQuestionPassageText(q);
}

function findPartPassage(questions: ExamQuestion[], start: number, end: number): string | undefined {
  for (let i = start; i <= end; i++) {
    const p = getQuestionPassageText(questions[i]);
    if (p) return p;
  }
  return undefined;
}

/** Nhóm câu theo phần (partOrder từ structure); không tách theo passage. */
export function buildExamParts(
  questions: ExamQuestion[],
  partOrder?: string[],
  subjectCode?: string,
): ExamPart[] {
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
      label: catalogPartLabel(subjectCode, partKey),
      subtitle: getPartSubtitleVi(subjectCode, partKey),
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
export function buildExamClusters(
  questions: ExamQuestion[],
  partOrder?: string[],
  subjectCode?: string,
): ExamPart[] {
  return buildExamParts(questions, partOrder, subjectCode);
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
