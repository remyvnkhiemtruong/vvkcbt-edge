import { RichTextContent } from './RichTextContent';
import { ClusterSubtypeRenderer } from './ClusterSubtypeRenderer';
import { TrueFalseRenderer } from './TrueFalseRenderer';
import { ShortAnswerRenderer } from './ShortAnswerRenderer';
import { InformaticsCodeRenderer } from './InformaticsCodeRenderer';
import type { InformaticsCodeBlock } from '@vnu/shared-types';

interface Question {
  id: string;
  type: string;
  part?: string;
  clusterSubtype?: string;
  content: {
    stem?: string;
    stemAfter?: string;
    sentences?: string[];
    passage?: string;
    title?: string;
    instruction?: string;
    body?: string;
    options?: string[];
    statements?: string[];
    subtype?: string;
    codeBlocks?: InformaticsCodeBlock[];
    codeDisplay?: 'tabs' | 'side_by_side';
  };
  passage?: { title?: string; body?: string };
}

interface Props {
  question: Question;
  answer: unknown;
  onChange: (answer: unknown) => void;
  onClick?: () => void;
  hideClusterPassage?: boolean;
  hideStem?: boolean;
  readOnly?: boolean;
}

function renderStem(stem?: string) {
  if (!stem) return null;
  return <RichTextContent content={stem} />;
}

export function QuestionRenderer({
  question,
  answer,
  onChange,
  onClick,
  hideClusterPassage = false,
  hideStem = false,
  readOnly = false,
}: Props) {
  const { content, type } = question;
  const passageText =
    content.passage ||
    question.passage?.body ||
    (content.body as string | undefined);
  const disabled = readOnly;
  const codeBlocks = content.codeBlocks;
  const codeDisplay = content.codeDisplay;
  const hasCode = !!codeBlocks?.length;
  const showStemBlock = type !== 'cluster_mcq' && !hideStem;

  return (
    <div className="question" onClick={onClick}>
      {passageText && !hideClusterPassage && type !== 'cluster_mcq' && (
        <div className="passage">
          <RichTextContent content={passageText} />
        </div>
      )}
      {showStemBlock && renderStem(content.stem) && (
        <div className="stem">{renderStem(content.stem)}</div>
      )}
      {hasCode ? (
        <InformaticsCodeRenderer codeBlocks={codeBlocks} codeDisplay={codeDisplay} />
      ) : null}
      {showStemBlock && content.stemAfter ? (
        <div className="stem stem-after-code">
          <RichTextContent content={content.stemAfter} />
        </div>
      ) : null}

      {type === 'cluster_mcq' && content.options && (
        <ClusterSubtypeRenderer
          subtype={(content.subtype as string) || question.clusterSubtype}
          instruction={hideClusterPassage ? undefined : content.instruction}
          passage={hideClusterPassage ? undefined : passageText}
          sentences={content.sentences}
          stem={content.stem}
          options={content.options}
          answer={answer}
          onChange={onChange}
          questionId={question.id}
          readOnly={disabled}
          hideSharedContext={hideClusterPassage}
        />
      )}

      {type === 'mcq' && content.options && (
        <div className="options">
          {content.options.map((opt) => {
            const key = opt.charAt(0);
            return (
              <label key={key} className={answer === key ? 'selected' : ''}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === key}
                  disabled={disabled}
                  onChange={() => onChange(key)}
                />
                <RichTextContent content={opt} />
              </label>
            );
          })}
        </div>
      )}

      {type === 'true_false' && content.statements && (
        <TrueFalseRenderer
          statements={content.statements}
          answer={answer}
          onChange={onChange}
          readOnly={disabled}
        />
      )}

      {type === 'short_answer' && (
        <ShortAnswerRenderer
          answer={answer}
          onChange={onChange}
          readOnly={disabled}
          inputId={`short-answer-${question.id}`}
        />
      )}

      {type === 'essay' && (
        <div>
          {question.part && (
            <p className="essay-part-label" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {question.part === 'part1_reading'
                ? 'Phần I — Đọc hiểu (4 điểm)'
                : question.part === 'part2_writing'
                  ? 'Phần II — Nghị luận (6 điểm)'
                  : question.part}
            </p>
          )}
          <textarea
            className="essay-answer"
            rows={12}
            value={(answer as string) || ''}
            readOnly={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Viết bài của bạn tại đây..."
          />
        </div>
      )}
    </div>
  );
}
