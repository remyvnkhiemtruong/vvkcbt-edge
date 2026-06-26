import { RichTextContent } from './RichTextContent';

const STMT_LABELS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

interface Props {
  statements: string[];
  answer: unknown;
  onChange: (answer: boolean[]) => void;
  readOnly?: boolean;
}

function stmtLabel(stmt: string, index: number): string {
  const trimmed = stmt.trim();
  if (/^[a-zđ]\)/i.test(trimmed) || /^\d+[\).]/.test(trimmed)) return '';
  return `${STMT_LABELS[index] ?? index + 1})`;
}

export function TrueFalseRenderer({ statements, answer, onChange, readOnly = false }: Props) {
  const values = statements.map((_, i) => {
    if (!Array.isArray(answer)) return undefined;
    const v = answer[i];
    return v === true || v === false ? v : undefined;
  });

  const setAt = (index: number, value: boolean) => {
    if (readOnly) return;
    const next = statements.map((_, i) => values[i]);
    next[index] = value;
    onChange(next as boolean[]);
  };

  return (
    <div className="true-false-table" role="group" aria-label="Câu trắc nghiệm đúng sai">
      <div className="true-false-table__head" aria-hidden>
        <span className="true-false-table__head-stmt">Mệnh đề</span>
        <span className="true-false-table__head-choice">Đúng</span>
        <span className="true-false-table__head-choice">Sai</span>
      </div>
      {statements.map((stmt, i) => {
        const prefix = stmtLabel(stmt, i);
        const selected = values[i];
        return (
          <div key={i} className={`true-false-table__row ${selected !== undefined ? 'is-answered' : ''}`}>
            <div className="true-false-table__stmt">
              {prefix && <span className="true-false-table__label">{prefix}</span>}
              <span className="true-false-table__text">
                <RichTextContent content={stmt} />
              </span>
            </div>
            <div className="true-false-table__choice">
              <button
                type="button"
                className={`true-false-table__btn true-false-table__btn--true ${selected === true ? 'is-selected' : ''}`}
                disabled={readOnly}
                aria-pressed={selected === true}
                aria-label={`Mệnh đề ${i + 1}: Đúng`}
                onClick={(e) => {
                  e.stopPropagation();
                  setAt(i, true);
                }}
              >
                Đ
              </button>
            </div>
            <div className="true-false-table__choice">
              <button
                type="button"
                className={`true-false-table__btn true-false-table__btn--false ${selected === false ? 'is-selected' : ''}`}
                disabled={readOnly}
                aria-pressed={selected === false}
                aria-label={`Mệnh đề ${i + 1}: Sai`}
                onClick={(e) => {
                  e.stopPropagation();
                  setAt(i, false);
                }}
              >
                S
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
