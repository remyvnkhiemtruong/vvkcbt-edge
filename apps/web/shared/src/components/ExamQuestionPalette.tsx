import { buildExamParts, findPartIndex, isQuestionAnswered } from '../utils/exam-clusters';
import type { ExamQuestion } from './ExamViewShell';

interface ExamQuestionPaletteProps {
  questions: ExamQuestion[];
  answers: Record<string, unknown>;
  currentIdx: number;
  onSelect: (idx: number) => void;
  partOrder?: string[];
}

export function ExamQuestionPalette({
  questions,
  answers,
  currentIdx,
  onSelect,
  partOrder,
}: ExamQuestionPaletteProps) {
  const parts = buildExamParts(questions, partOrder);
  const activePartIdx = findPartIndex(parts, currentIdx);

  return (
    <nav className="exam-palette" aria-label="Điều hướng câu hỏi">
      <div className="exam-palette__inner">
        {parts.map((part, pi) => (
          <div key={part.partKey} className="exam-palette__group">
            {pi > 0 && <span className="exam-palette__sep" aria-hidden />}
            {questions.slice(part.start, part.end + 1).map((q, j) => {
              const i = part.start + j;
              const inPart = activePartIdx === pi;
              const answered = isQuestionAnswered(answers[q.id]);
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  className={[
                    'exam-palette__btn',
                    inPart ? 'in-part' : '',
                    isCurrent ? 'is-current' : '',
                    answered ? 'is-answered' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => onSelect(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
