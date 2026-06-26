import { useState } from 'react';
import { QuestionRenderer } from './QuestionRenderer';
import { vi } from '../i18n/vi';

export type ExamUiMode = 'split_view' | 'vertical_focus';

export interface ExamQuestion {
  id: string;
  type?: string;
  part?: string;
  clusterSubtype?: string;
  content?: {
    stem?: string;
    passage?: string;
    title?: string;
    body?: string;
    options?: string[];
    statements?: string[];
    subtype?: string;
    audio_id?: string;
  };
  passage?: { title?: string; body?: string };
}

export interface ExamViewShellProps {
  questions: ExamQuestion[];
  answers: Record<string, unknown>;
  onChange: (questionId: string, answer: unknown) => void;
  uiMode: ExamUiMode;
  sharedPassage?: string;
  readOnly?: boolean;
  showNav?: boolean;
  currentIdx?: number;
  onCurrentIdxChange?: (idx: number) => void;
  onQuestionClick?: (idx: number) => void;
}

export function ExamViewShell({
  questions,
  answers,
  onChange,
  uiMode,
  sharedPassage,
  readOnly = false,
  showNav = true,
  currentIdx: controlledIdx,
  onCurrentIdxChange,
  onQuestionClick,
}: ExamViewShellProps) {
  const [internalIdx, setInternalIdx] = useState(0);
  const currentIdx = controlledIdx ?? internalIdx;
  const setCurrentIdx = onCurrentIdxChange ?? setInternalIdx;

  const current = questions[currentIdx];
  const hideClusterPassage = uiMode === 'vertical_focus' && !!sharedPassage;

  const handleChange = (questionId: string, answer: unknown) => {
    if (readOnly) return;
    onChange(questionId, answer);
  };

  const passageBlock = sharedPassage ? (
    <aside className="passage-panel">
      <h3 className="passage-title">
        {vi.exam.passageTitle} {vi.exam.passageRange(1, questions.length)}
      </h3>
      <p>{sharedPassage}</p>
    </aside>
  ) : null;

  return (
    <div className={`exam-view-shell exam-body ${uiMode === 'split_view' ? 'split-view' : 'vertical-focus'}`}>
      {uiMode === 'split_view' && sharedPassage && passageBlock}

      <main className="question-panel">
        {uiMode === 'vertical_focus' ? (
          <>
            {sharedPassage && <div className="vertical-passage-sticky">{passageBlock}</div>}
            {questions.map((q, i) => (
              <div
                key={q.id}
                id={`q-${i}`}
                tabIndex={0}
                className="question"
                onClick={() => onQuestionClick?.(i)}
              >
                <span className="q-num">{vi.exam.questionNum(i + 1)}</span>
                <QuestionRenderer
                  question={q as never}
                  answer={answers[q.id]}
                  onChange={(a) => handleChange(q.id, a)}
                  hideClusterPassage={hideClusterPassage}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </>
        ) : (
          current && (
            <>
              <span className="q-num">{vi.exam.questionNum(currentIdx + 1)}</span>
              <QuestionRenderer
                question={current as never}
                answer={answers[current.id]}
                onChange={(a) => handleChange(current.id, a)}
                readOnly={readOnly}
              />
            </>
          )
        )}
      </main>

      {uiMode === 'split_view' && showNav && questions.length > 1 && (
        <nav className="q-nav" aria-label="Điều hướng câu hỏi">
          {questions.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === currentIdx ? 'active' : ''}
              onClick={() => {
                setCurrentIdx(i);
                onQuestionClick?.(i);
              }}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
