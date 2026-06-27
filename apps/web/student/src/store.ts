import { create } from 'zustand';

interface ExamState {
  token: string | null;
  sessionId: string | null;
  examSessionId: string;
  exam: Record<string, unknown> | null;
  answers: Record<string, unknown>;
  violations: number;
  locked: boolean;
  submitted: boolean;
  rulesAccepted: boolean;
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
  setAnswers: (answers: Record<string, unknown>) => void;
  setViolations: (n: number) => void;
  setLocked: (v: boolean) => void;
  setSubmitted: (result: ExamState['scoreResult'] & object) => void;
  setExamSessionId: (id: string) => void;
  setRulesAccepted: (v: boolean) => void;
  syncStatus: 'synced' | 'local' | 'offline' | 'syncing';
  setSyncStatus: (status: ExamState['syncStatus']) => void;
  logout: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  token: localStorage.getItem('vnu_token'),
  sessionId: localStorage.getItem('vnu_session_id'),
  examSessionId: localStorage.getItem('vnu_exam_session_id') || '',
  exam: null,
  answers: {},
  violations: 0,
  locked: false,
  submitted: false,
  rulesAccepted: false,
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
      sbd: opts?.sbd ?? null,
      examAccount: opts?.examAccount ?? null,
    });
  },
  setExam: (exam) => set({ exam, answers: (exam.answers as Record<string, unknown>) || {} }),
  setAnswer: (questionId, answer) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: answer } })),
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
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  logout: () => {
    localStorage.removeItem('vnu_token');
    localStorage.removeItem('vnu_session_id');
    localStorage.removeItem('vnu_exam_session_id');
    set({
      token: null,
      sessionId: null,
      examSessionId: '',
      exam: null,
      answers: {},
      violations: 0,
      locked: false,
      submitted: false,
      scoreResult: null,
      rulesAccepted: false,
      sbd: null,
      examAccount: null,
      syncStatus: 'synced',
    });
  },
}));
