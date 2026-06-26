/** Exam lock mode: browser (Chrome kiosk/F11) or seb (Safe Exam Browser). */
export type ExamLockMode = 'browser' | 'seb';

export function getExamLockMode(): ExamLockMode {
  const mode =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: { VITE_EXAM_LOCK_MODE?: string } }).env?.VITE_EXAM_LOCK_MODE
      : 'browser';
  return mode === 'seb' ? 'seb' : 'browser';
}

export function requiresSebLock(): boolean {
  return getExamLockMode() === 'seb';
}
