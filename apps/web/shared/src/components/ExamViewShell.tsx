import type { CSSProperties } from 'react';

import { useMemo } from 'react';

import { QuestionRenderer } from './QuestionRenderer';

import { RichTextContent } from './RichTextContent';

import { vi } from '../i18n/vi';

import {

  buildExamParts,

  buildViewGroups,

  findPartIndex,

  findViewGroupIndex,

  getPartLabelVi,

  getQuestionPassageText,

  getSplitPaneText,

  isQuestionAnswered,

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



export function ExamViewShell({

  questions,

  answers,

  onChange,

  uiMode,

  onViewModeChange,

  sharedPassage,

  readOnly = false,

  currentIdx = 0,

  onCurrentIdxChange,

  onQuestionClick,

  fontScale = 1,

  subjectCode,

  partOrder,

}: ExamViewShellProps) {

  const parts = useMemo(

    () => buildExamParts(questions, partOrder, subjectCode),

    [questions, partOrder, subjectCode],

  );

  const viewGroups = useMemo(() => buildViewGroups(questions), [questions]);

  const partIdx = findPartIndex(parts, currentIdx);

  const currentPart = parts[partIdx] ?? parts[0] ?? {

    start: 0,

    end: Math.max(0, questions.length - 1),

    partKey: '_default',

    label: 'Phần I',

    questionCount: questions.length,

  };

  const viewGroupIdx = findViewGroupIndex(viewGroups, currentIdx);

  const currentViewGroup = viewGroups[viewGroupIdx] ?? { start: 0, end: Math.max(0, questions.length - 1) };

  const partQuestions = questions.slice(currentPart.start, currentPart.end + 1);
  const splitQuestions = questions.slice(currentViewGroup.start, currentViewGroup.end + 1);
  const splitStart = currentViewGroup.start;
  const verticalStart = currentPart.start;

  const activeQuestion = questions[currentIdx] ?? (uiMode === 'split_view' ? splitQuestions[0] : partQuestions[0]);

  const activePassage =

    uiMode === 'split_view'

      ? currentViewGroup.passage ||

        getSplitPaneText(activeQuestion) ||

        currentPart.passage ||

        sharedPassage

      : getQuestionPassageText(questions[currentPart.start]) || currentPart.passage || sharedPassage;



  const hasPassage = !!activePassage?.trim();

  const hidePassageInBody = hasPassage && (uiMode === 'split_view' || uiMode === 'vertical_focus');

  const hideStemInBody =

    uiMode === 'split_view' &&

    currentViewGroup.start === currentViewGroup.end &&

    (activeQuestion?.type === 'true_false' || activeQuestion?.type === 'short_answer');



  const handleChange = (questionId: string, answer: unknown) => {

    if (readOnly) return;

    onChange(questionId, answer);

  };



  const rangeLabel =
    uiMode === 'split_view'
      ? currentViewGroup.start === currentViewGroup.end
        ? vi.exam.questionNum(currentViewGroup.start + 1)
        : `Câu ${currentViewGroup.start + 1}–${currentViewGroup.end + 1}`
      : currentPart.start === currentPart.end
        ? vi.exam.questionNum(currentPart.start + 1)
        : `Câu ${currentPart.start + 1}–${currentPart.end + 1}`;

  const renderQuestionBlock = (q: ExamQuestion, i: number, globalIdx: number, totalInView: number) => {

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

          hideClusterPassage={hidePassageInBody}

          hideStem={

            hideStemInBody &&

            (q.type === 'true_false' || q.type === 'short_answer') &&

            !!q.content?.stem?.trim()

          }

          readOnly={readOnly}

        />

        {i < totalInView - 1 && <hr className="exam-q-divider" />}

      </div>

    );

  };



  const passageContent = (

    <div className="exam-passage-box">

      {activeQuestion?.content?.instruction && (

        <p className="exam-passage-instruction">

          <RichTextContent content={activeQuestion.content.instruction} />

        </p>

      )}

      {activePassage && <RichTextContent content={activePassage} />}

    </div>

  );



  const splitPaneCaption =

    (activeQuestion?.type === 'true_false' || activeQuestion?.type === 'short_answer') &&

    activeQuestion.content?.stem?.trim()

      ? 'Đề bài'

      : undefined;



  const partHeadingEl = (

    <div className="part-divider">

      <div className="part-divider__title">

        {currentPart.label || getPartLabelVi(currentPart.partKey, subjectCode)}

      </div>

      {currentPart.subtitle && <div className="part-divider__subtitle">{currentPart.subtitle}</div>}

    </div>

  );



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



      {uiMode === 'split_view' ? (

        <div className={`exam-split ${hasPassage ? 'has-passage' : 'no-passage'}`}>

          {hasPassage && (

            <aside className="exam-split__passage">

              <div className="exam-split__pane-inner">

                {partHeadingEl}

                {splitPaneCaption && (

                  <p className="exam-passage-instruction">{splitPaneCaption}</p>

                )}

                {passageContent}

              </div>

            </aside>

          )}

          <main className="exam-split__questions">

            <div className="exam-split__pane-inner">

              {!hasPassage && partHeadingEl}

              {splitQuestions.map((q, i) => renderQuestionBlock(q, i, splitStart + i, splitQuestions.length))}

            </div>

          </main>

        </div>

      ) : (

        <main className="exam-vertical">

          {hasPassage && (

            <div className="exam-vertical__passage">

              {partHeadingEl}

              {passageContent}

            </div>

          )}

          <div className="exam-vertical__questions">

            {!hasPassage && partHeadingEl}

            {partQuestions.map((q, i) => {
              const globalIdx = verticalStart + i;
              const prevQ = i > 0 ? partQuestions[i - 1] : undefined;
              const prevPassage = prevQ ? getQuestionPassageText(prevQ) : '';
              const thisPassage = getQuestionPassageText(q);
              const showInlinePassage =
                !hasPassage && thisPassage && thisPassage !== prevPassage && uiMode === 'vertical_focus';
              return (
                <div key={q.id}>
                  {showInlinePassage && (
                    <div className="exam-passage-box exam-passage-box--inline">
                      <RichTextContent content={thisPassage} />
                    </div>
                  )}
                  {renderQuestionBlock(q, i, globalIdx, partQuestions.length)}
                </div>
              );
            })}

          </div>

        </main>

      )}

    </div>

  );

}


