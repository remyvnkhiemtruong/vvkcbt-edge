import { create } from 'zustand';

interface ExamState {
  token: string | null;
  sessionId: string | null;
  examSessionId: string;
  exam: Record<string, unknown> | null;
  answers: Record<string, unknown>;
  markedQuestions: Record<string, boolean>;
  violations: number;
  locked: boolean;
  submitted: boolean;
  rulesAccepted: boolean;
  identityConfirmed: boolean;
  scoreResult: {
    total: number;
    breakdown?: unknown[];
    subject?: string;
    partScores?: {
      part1: number;
      part2: number;
      part3: number;
      maxPart1: number;
      maxPart2: number;
      maxPart3: number;
    };
    informaticsBranchInvalid?: boolean;
  } | null;
  sbd: string | null;
  examAccount: string | null;
  setAuth: (
    token: string,
    sessionId: string,
    opts?: { subjectCode?: string | null; sbd?: string; examAccount?: string | null },
  ) => void;
  setExam: (exam: Record<string, unknown>) => void;
  setAnswer: (questionId: string, answer: unknown) => void;
  toggleMarkQuestion: (questionId: string) => void;
  unmarkQuestion: (questionId: string) => void;
  setAnswers: (answers: Record<string, unknown>) => void;
  setViolations: (n: number) => void;
  setLocked: (v: boolean) => void;
  setSubmitted: (result: ExamState['scoreResult'] & object) => void;
  setExamSessionId: (id: string) => void;
  setRulesAccepted: (v: boolean) => void;
  setIdentityConfirmed: (v: boolean) => void;
  syncStatus: 'synced' | 'local' | 'offline' | 'syncing';
  setSyncStatus: (status: ExamState['syncStatus']) => void;
  logout: () => void;
}

function loadMarkedQuestions(sessionId: string | null): Record<string, boolean> {
  if (!sessionId) return {};
  try {
    return JSON.parse(localStorage.getItem(`vnu_marks_${sessionId}`) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function persistMarkedQuestions(sessionId: string | null, marked: Record<string, boolean>) {
  if (!sessionId) return;
  if (Object.keys(marked).length === 0) {
    localStorage.removeItem(`vnu_marks_${sessionId}`);
    return;
  }
  localStorage.setItem(`vnu_marks_${sessionId}`, JSON.stringify(marked));
}

export const useExamStore = create<ExamState>((set) => ({
  token: localStorage.getItem('vnu_token'),
  sessionId: localStorage.getItem('vnu_session_id'),
  examSessionId: localStorage.getItem('vnu_exam_session_id') || '',
  exam: null,
  answers: {},
  markedQuestions: loadMarkedQuestions(localStorage.getItem('vnu_session_id')),
  violations: 0,
  locked: false,
  submitted: false,
  rulesAccepted: false,
  identityConfirmed: false,
  scoreResult: null,
  sbd: null,
  examAccount: null,
  syncStatus: 'synced',
  setAuth: (token, sessionId, opts) => {
    localStorage.setItem('vnu_token', token);
    localStorage.setItem('vnu_session_id', sessionId);
    set({
      token,
      sessionId,
      rulesAccepted: false,
      identityConfirmed: false,
      markedQuestions: loadMarkedQuestions(sessionId),
      sbd: opts?.sbd ?? null,
      examAccount: opts?.examAccount ?? null,
    });
  },
  setExam: (exam) => {
    const questions = Array.isArray(exam.questions) ? exam.questions : [];
    const answers = (exam.answers as Record<string, unknown>) || {};
    set({ exam: { ...exam, questions }, answers });
  },
  setAnswer: (questionId, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
  toggleMarkQuestion: (questionId) =>
    set((s) => {
      const markedQuestions = { ...s.markedQuestions };
      if (markedQuestions[questionId]) delete markedQuestions[questionId];
      else markedQuestions[questionId] = true;
      persistMarkedQuestions(s.sessionId, markedQuestions);
      return { markedQuestions };
    }),
  unmarkQuestion: (questionId) =>
    set((s) => {
      if (!s.markedQuestions[questionId]) return s;
      const markedQuestions = { ...s.markedQuestions };
      delete markedQuestions[questionId];
      persistMarkedQuestions(s.sessionId, markedQuestions);
      return { markedQuestions };
    }),
  setAnswers: (answers) => set({ answers }),
  setViolations: (violations) => set({ violations }),
  setLocked: (locked) => set({ locked }),
  setSubmitted: (scoreResult: ExamState['scoreResult'] & object) =>
    set({ submitted: true, scoreResult }),
  setExamSessionId: (examSessionId) => {
    localStorage.setItem('vnu_exam_session_id', examSessionId);
    set({ examSessionId });
  },
  setRulesAccepted: (rulesAccepted) => set({ rulesAccepted }),
  setIdentityConfirmed: (identityConfirmed) => set({ identityConfirmed }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  logout: () => {
    const sid = localStorage.getItem('vnu_session_id');
    if (sid) localStorage.removeItem(`vnu_marks_${sid}`);
    localStorage.removeItem('vnu_token');
    localStorage.removeItem('vnu_session_id');
    localStorage.removeItem('vnu_exam_session_id');
    set({
      token: null,
      sessionId: null,
      examSessionId: '',
      exam: null,
      answers: {},
      markedQuestions: {},
      violations: 0,
      locked: false,
      submitted: false,
      scoreResult: null,
      rulesAccepted: false,
      identityConfirmed: false,
      sbd: null,
      examAccount: null,
      syncStatus: 'synced',
    });
  },
}));
