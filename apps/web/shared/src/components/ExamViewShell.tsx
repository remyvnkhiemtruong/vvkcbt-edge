import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { QuestionRenderer } from './QuestionRenderer';
import { RichTextContent } from './RichTextContent';
import { vi } from '../i18n/vi';
import {
  buildExamParts,
  buildClusterRuns,
  clusterRunHasContext,
  findPartIndex,
  getPartLabelVi,
  isQuestionAnswered,
  isReorderClusterRun,
  type ExamClusterRun,
} from '../utils/exam-clusters';

export type ExamUiMode = 'split_view' | 'vertical_focus';

export interface ExamQuestion {
  id: string;
  type?: string;
  part?: string;
  clusterId?: string;
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
    instruction?: string;
  };
  passage?: { title?: string; body?: string };
}

export interface ExamViewShellProps {
  questions: ExamQuestion[];
  answers: Record<string, unknown>;
  onChange: (questionId: string, answer: unknown) => void;
  uiMode: ExamUiMode;
  onViewModeChange?: (mode: ExamUiMode) => void;
  sharedPassage?: string;
  readOnly?: boolean;
  currentIdx?: number;
  onCurrentIdxChange?: (idx: number) => void;
  onQuestionClick?: (idx: number) => void;
  fontScale?: number;
  subjectCode?: string;
  partOrder?: string[];
}

function ClusterContextPanel({ run }: { run: ExamClusterRun }) {
  const reorder = isReorderClusterRun(run);
  return (
    <div className="exam-passage-box">
      {run.instruction ? (
        <p className="exam-passage-instruction">
          <RichTextContent content={run.instruction} />
        </p>
      ) : null}
      {!reorder && run.passage ? <RichTextContent content={run.passage} /> : null}
    </div>
  );
}

export function ExamViewShell({
  questions,
  answers,
  onChange,
  uiMode,
  onViewModeChange,
  readOnly = false,
  currentIdx = 0,
  onCurrentIdxChange,
  onQuestionClick,
  fontScale = 1,
  partOrder,
}: ExamViewShellProps) {
  const parts = useMemo(() => buildExamParts(questions, partOrder), [questions, partOrder]);
  const partIdx = findPartIndex(parts, currentIdx);
  const currentPart = parts[partIdx] ?? parts[0] ?? {
    start: 0,
    end: Math.max(0, questions.length - 1),
    partKey: '_default',
    label: 'Phần I',
    questionCount: questions.length,
  };

  const clusterRuns = useMemo(
    () => buildClusterRuns(questions, currentPart.start, currentPart.end),
    [questions, currentPart.start, currentPart.end],
  );

  const handleChange = (questionId: string, answer: unknown) => {
    if (readOnly) return;
    onChange(questionId, answer);
  };

  const rangeLabel =
    currentPart.start === currentPart.end
      ? vi.exam.questionNum(currentPart.start + 1)
      : `Câu ${currentPart.start + 1}–${currentPart.end + 1}`;

  const renderQuestionBlock = (q: ExamQuestion, globalIdx: number, hideContext: boolean) => {
    const answered = isQuestionAnswered(answers[q.id]);
    return (
      <div
        key={q.id}
        id={`q-${globalIdx}`}
        className={`exam-q-block ${globalIdx === currentIdx ? 'is-current' : ''} ${answered ? 'is-answered' : ''}`}
        onClick={() => {
          onCurrentIdxChange?.(globalIdx);
          onQuestionClick?.(globalIdx);
        }}
      >
        <div className="exam-q-block__head">
          <span className="exam-q-block__num">{globalIdx + 1}.</span>
          {answered && <span className="exam-q-block__badge exam-q-block__badge--done">Đã làm</span>}
        </div>
        <QuestionRenderer
          question={q as never}
          answer={answers[q.id]}
          onChange={(a) => handleChange(q.id, a)}
          hideClusterPassage={hideContext}
          readOnly={readOnly}
        />
      </div>
    );
  };

  const partHeadingEl = (
    <div className="part-divider">{currentPart.label || getPartLabelVi(currentPart.partKey)}</div>
  );

  const clusterSections: ReactNode = clusterRuns.map((run) => {
    const hasContext = clusterRunHasContext(run);
    return (
      <section
        key={`${run.clusterId}-${run.questions[0]?.globalIdx ?? 0}`}
        className={`exam-cluster-split ${hasContext ? 'has-context' : 'no-context'}`}
      >
        {hasContext && (
          <aside className="exam-cluster-split__context">
            <ClusterContextPanel run={run} />
          </aside>
        )}
        <main className="exam-cluster-split__questions">
          {run.questions.map(({ q, globalIdx }, i) => (
            <div key={q.id}>
              {renderQuestionBlock(q, globalIdx, hasContext)}
              {i < run.questions.length - 1 && <hr className="exam-q-divider" />}
            </div>
          ))}
        </main>
      </section>
    );
  });

  return (
    <div
      className="exam-card"
      style={{ '--exam-font-scale': fontScale } as CSSProperties}
    >
      <div className="exam-card__toolbar">
        <div className="exam-card__range">
          <span className="exam-card__range-icon" aria-hidden>
            ?
          </span>
          <span className="exam-card__range-text">{rangeLabel}</span>
        </div>
        {onViewModeChange && (
          <select
            className="exam-view-select"
            value={uiMode}
            onChange={(e) => onViewModeChange(e.target.value as ExamUiMode)}
            aria-label={vi.exam.viewModeLabel}
          >
            <option value="split_view">{vi.exam.displayHorizontal}</option>
            <option value="vertical_focus">{vi.exam.displayVertical}</option>
          </select>
        )}
      </div>

      <div className={`exam-cluster-stack ${uiMode === 'split_view' ? 'exam-cluster-stack--split' : 'exam-cluster-stack--vertical'}`}>
        {partHeadingEl}
        {clusterSections}
      </div>
    </div>
  );
}
