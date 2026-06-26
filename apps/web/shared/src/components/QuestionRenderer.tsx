import { RichTextContent } from './RichTextContent';
import { ClusterSubtypeRenderer } from './ClusterSubtypeRenderer';

interface Question {
  id: string;
  type: string;
  part?: string;
  clusterSubtype?: string;
  content: {
    stem?: string;
    passage?: string;
    title?: string;
    body?: string;
    options?: string[];
    statements?: string[];
    subtype?: string;
  };
  passage?: { title?: string; body?: string };
}

interface Props {
  question: Question;
  answer: unknown;
  onChange: (answer: unknown) => void;
  onClick?: () => void;
  hideClusterPassage?: boolean;
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
  readOnly = false,
}: Props) {
  const { content, type } = question;
  const passageText =
    content.passage ||
    question.passage?.body ||
    (content.body as string | undefined);
  const disabled = readOnly;

  return (
    <div className="question" onClick={onClick}>
      {passageText && !hideClusterPassage && type !== 'cluster_mcq' && (
        <div className="passage">
          <RichTextContent content={passageText} />
        </div>
      )}
      <div className="stem">{type !== 'cluster_mcq' ? renderStem(content.stem) : null}</div>

      {type === 'cluster_mcq' && content.options && (
        <ClusterSubtypeRenderer
          subtype={(content.subtype as string) || question.clusterSubtype}
          passage={hideClusterPassage ? undefined : passageText}
          stem={content.stem}
          options={content.options}
          answer={answer}
          onChange={onChange}
          questionId={question.id}
          readOnly={disabled}
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
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {type === 'true_false' && content.statements && (
        <div className="true-false">
          {content.statements.map((stmt, i) => {
            const arr = (answer as boolean[]) || [false, false, false, false];
            return (
              <label key={i}>
                <span>{stmt}</span>
                <select
                  disabled={disabled}
                  value={arr[i] === true ? 'true' : arr[i] === false ? 'false' : ''}
                  onChange={(e) => {
                    const next = [...arr];
                    next[i] = e.target.value === 'true';
                    onChange(next);
                  }}
                >
                  <option value="">--</option>
                  <option value="true">Đúng</option>
                  <option value="false">Sai</option>
                </select>
              </label>
            );
          })}
        </div>
      )}

      {type === 'short_answer' && (
        <input
          type="text"
          className="short-answer"
          value={(answer as string) || ''}
          readOnly={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập đáp án..."
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
