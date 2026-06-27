import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { QuestionRenderer } from './QuestionRenderer';
import { RichTextContent } from './RichTextContent';
import { InformaticsCodeRenderer } from './InformaticsCodeRenderer';
import { vi } from '../i18n/vi';
import {
  buildExamParts,
  buildClusterRuns,
  clusterRunHasContext,
  findPartIndex,
  getExamViewRangeLabel,
  getPartLabelVi,
  getQuestionPassageText,
  getVisibleClusterRuns,
  isQuestionAnswered,
  isReorderClusterRun,
  shouldUseStemSplit,
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
    stemAfter?: string;
    passage?: string;
    title?: string;
    body?: string;
    options?: string[];
    statements?: string[];
    subtype?: string;
    audio_id?: string;
    instruction?: string;
    codeBlocks?: Array<{ language?: string; code?: string; label?: string }>;
    codeDisplay?: 'tabs' | 'side_by_side';
  };
  passage?: { title?: string; body?: string };
}

export interface ExamViewShellProps {
  questions: ExamQuestion[];
  answers: Record<string, unknown>;
  markedQuestionIds?: Record<string, boolean>;
  onToggleMark?: (questionId: string) => void;
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

function StemContextPanel({ q }: { q: ExamQuestion }) {
  const passage = getQuestionPassageText(q);
  const stem = q.content?.stem;
  const codeBlocks = q.content?.codeBlocks;
  const stemAfter = q.content?.stemAfter;

  return (
    <div className="exam-passage-box exam-stem-context-panel">
      {q.content?.instruction ? (
        <p className="exam-passage-instruction">
          <RichTextContent content={q.content.instruction} />
        </p>
      ) : null}
      {passage ? <RichTextContent content={passage} /> : null}
      {stem ? (
        <div className={passage ? 'exam-stem-context-panel__stem' : undefined}>
          <RichTextContent content={stem} />
        </div>
      ) : null}
      {codeBlocks?.length ? (
        <InformaticsCodeRenderer
          codeBlocks={codeBlocks as never}
          codeDisplay={q.content?.codeDisplay}
        />
      ) : null}
      {stemAfter ? (
        <div className="exam-stem-context-panel__stem-after">
          <RichTextContent content={stemAfter} />
        </div>
      ) : null}
    </div>
  );
}

export function ExamViewShell({
  questions,
  answers,
  markedQuestionIds,
  onToggleMark,
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

  const visibleRuns = useMemo(
    () => getVisibleClusterRuns(clusterRuns, currentIdx, uiMode),
    [clusterRuns, currentIdx, uiMode],
  );

  const handleChange = (questionId: string, answer: unknown) => {
    if (readOnly) return;
    onChange(questionId, answer);
  };

  const rangeLabel = getExamViewRangeLabel(uiMode, currentIdx, currentPart, vi.exam.questionNum);

  const renderQuestionBlock = (
    q: ExamQuestion,
    globalIdx: number,
    hideContext: boolean,
    answerOnly = false,
  ) => {
    const answered = isQuestionAnswered(answers[q.id]);
    const isMarked = !!markedQuestionIds?.[q.id];
    return (
      <div
        key={q.id}
        id={`q-${globalIdx}`}
        className={`exam-q-block ${globalIdx === currentIdx ? 'is-current' : ''} ${answered ? 'is-answered' : ''} ${isMarked ? 'is-marked' : ''}`}
        onClick={() => {
          onCurrentIdxChange?.(globalIdx);
          onQuestionClick?.(globalIdx);
        }}
      >
        <div className="exam-q-block__head">
          <span className="exam-q-block__num">{globalIdx + 1}.</span>
          <div className="exam-q-block__head-actions">
            {answered && <span className="exam-q-block__badge exam-q-block__badge--done">Đã làm</span>}
            {!readOnly && !answered && onToggleMark && (
              <button
                type="button"
                className={`exam-mark-btn${isMarked ? ' is-marked' : ''}`}
                aria-pressed={isMarked}
                title={isMarked ? vi.exam.unmarkQuestion : vi.exam.markQuestion}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMark(q.id);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M5 2h14l-1 7h4L9 22l2-9H5l-1-7z" />
                </svg>
                <span>{isMarked ? vi.exam.marked : vi.exam.markQuestion}</span>
              </button>
            )}
          </div>
        </div>
        <QuestionRenderer
          question={q as never}
          answer={answers[q.id]}
          onChange={(a) => handleChange(q.id, a)}
          hideClusterPassage={hideContext}
          hideStem={answerOnly}
          hideStemAfter={answerOnly}
          hideCode={answerOnly}
          readOnly={readOnly}
        />
      </div>
    );
  };

  const partHeadingEl = (
    <div className="part-divider">{currentPart.label || getPartLabelVi(currentPart.partKey)}</div>
  );

  const clusterSections: ReactNode = visibleRuns.map((run) => {
    const hasClusterContext = clusterRunHasContext(run);
    const hasStemSplit = shouldUseStemSplit(run, uiMode);
    const hideInQuestion = hasClusterContext || hasStemSplit;

    const sectionClass = [
      'exam-cluster-split',
      hasClusterContext ? 'has-context' : '',
      hasStemSplit ? 'has-stem-split' : '',
      !hasClusterContext && !hasStemSplit ? 'no-context' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <section
        key={`${run.clusterId}-${run.questions[0]?.globalIdx ?? 0}`}
        className={sectionClass}
      >
        {hasClusterContext && (
          <aside className="exam-cluster-split__context">
            <ClusterContextPanel run={run} />
          </aside>
        )}
        {hasStemSplit && run.questions[0] && (
          <aside className="exam-cluster-split__context">
            <StemContextPanel q={run.questions[0].q} />
          </aside>
        )}
        <main className="exam-cluster-split__questions">
          {run.questions.map(({ q, globalIdx }, i) => (
            <div key={q.id}>
              {renderQuestionBlock(q, globalIdx, hideInQuestion, hasStemSplit)}
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

      <div
        className={`exam-cluster-stack ${uiMode === 'split_view' ? 'exam-cluster-stack--split' : 'exam-cluster-stack--vertical'}`}
      >
        {partHeadingEl}
        {clusterSections}
      </div>
    </div>
  );
}
