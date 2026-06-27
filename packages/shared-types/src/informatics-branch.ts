/** Phần II Tin học: 6 câu Đ/S — câu 1–2 chung, 3–4 KHMT, 5–6 THUD. */

export type InformaticsTfSlot = 1 | 2 | 3 | 4 | 5 | 6;

export type InformaticsBranchSelection = 'common_only' | 'khmt' | 'thud' | 'invalid_optional';

export interface InformaticsQuestionRef {
  id: string;
  type?: string;
  part?: string;
  partKey?: string;
  informaticsSlot?: number;
  content?: { informaticsSlot?: number };
}

export function isTrueFalseAnswered(answer: unknown): boolean {
  if (answer === undefined || answer === null || answer === '') return false;
  if (!Array.isArray(answer) || answer.length === 0) return false;
  return answer.some((v) => v === true || v === false);
}

export function isInformaticsPart2Question(q: InformaticsQuestionRef): boolean {
  if (q.type !== 'true_false') return false;
  const part = q.part ?? q.partKey;
  return part === 'part2_true_false';
}

/** Lấy câu Đ/S phần II theo thứ tự trong đề. */
export function listInformaticsPart2Questions<T extends InformaticsQuestionRef>(
  questions: T[],
  subjectCode?: string,
): T[] {
  if ((subjectCode ?? '').toUpperCase() !== 'INFORMATICS') return [];
  return questions.filter(isInformaticsPart2Question);
}

export function resolveInformaticsTfSlot(
  question: InformaticsQuestionRef,
  indexInPart2: number,
): InformaticsTfSlot | null {
  const raw = question.informaticsSlot ?? question.content?.informaticsSlot;
  if (typeof raw === 'number' && raw >= 1 && raw <= 6) return raw as InformaticsTfSlot;
  const slot = indexInPart2 + 1;
  return slot >= 1 && slot <= 6 ? (slot as InformaticsTfSlot) : null;
}

export function resolveInformaticsBranch(
  slotsAnswered: Record<InformaticsTfSlot, boolean>,
): InformaticsBranchSelection {
  const khmt = slotsAnswered[3] || slotsAnswered[4];
  const thud = slotsAnswered[5] || slotsAnswered[6];
  if (!khmt && !thud) return 'common_only';
  if (khmt && !thud) return 'khmt';
  if (thud && !khmt) return 'thud';
  return 'invalid_optional';
}

export function resolveInformaticsBranchFromAnswers(
  part2Questions: InformaticsQuestionRef[],
  answers: Record<string, unknown>,
): InformaticsBranchSelection {
  const slots: Record<InformaticsTfSlot, boolean> = {
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  };
  part2Questions.forEach((q, i) => {
    const slot = resolveInformaticsTfSlot(q, i);
    if (slot && isTrueFalseAnswered(answers[q.id])) slots[slot] = true;
  });
  return resolveInformaticsBranch(slots);
}

export function isInformaticsOptionalSlot(slot: InformaticsTfSlot): boolean {
  return slot >= 3;
}

export function shouldScoreInformaticsOptionalSlot(
  slot: InformaticsTfSlot,
  branch: InformaticsBranchSelection,
): boolean {
  if (!isInformaticsOptionalSlot(slot)) return true;
  if (branch === 'khmt') return slot === 3 || slot === 4;
  if (branch === 'thud') return slot === 5 || slot === 6;
  return false;
}

export interface ScoreBreakdownRow {
  questionId: string;
  score: number;
  maxScore: number;
  [key: string]: unknown;
}

export function applyInformaticsBranchScoring<T extends ScoreBreakdownRow>(
  questions: InformaticsQuestionRef[],
  breakdown: T[],
  answers: Record<string, unknown>,
): { breakdown: T[]; branch: InformaticsBranchSelection; branchInvalid: boolean } {
  const part2 = listInformaticsPart2Questions(questions, 'INFORMATICS');
  if (!part2.length) {
    return { breakdown, branch: 'common_only', branchInvalid: false };
  }

  const branch = resolveInformaticsBranchFromAnswers(part2, answers);
  const slotById = new Map<string, InformaticsTfSlot>();
  part2.forEach((q, i) => {
    const slot = resolveInformaticsTfSlot(q, i);
    if (slot) slotById.set(q.id, slot);
  });

  const adjusted = breakdown.map((row) => {
    const slot = slotById.get(row.questionId);
    if (!slot || !isInformaticsOptionalSlot(slot)) return row;
    if (shouldScoreInformaticsOptionalSlot(slot, branch)) return row;
    return { ...row, score: 0, maxScore: 0 };
  });

  return {
    breakdown: adjusted,
    branch,
    branchInvalid: branch === 'invalid_optional',
  };
}
