import { useState } from 'react';
import { RichTextContent } from './RichTextContent';

type ClusterSubtype =
  | 'fill_notice'
  | 'fill_flyer'
  | 'reorder'
  | 'fill_gap'
  | 'reading_8'
  | 'reading_10'
  | string;

interface Props {
  subtype?: ClusterSubtype;
  passage?: string;
  stem?: string;
  options?: string[];
  answer: unknown;
  onChange: (answer: unknown) => void;
  questionId: string;
  readOnly?: boolean;
}

function McqOptions({
  options,
  answer,
  onChange,
  questionId,
  readOnly,
}: {
  options: string[];
  answer: unknown;
  onChange: (a: unknown) => void;
  questionId: string;
  readOnly?: boolean;
}) {
  return (
    <div className="options">
      {options.map((opt) => {
        const key = opt.charAt(0);
        return (
          <label key={key} className={answer === key ? 'selected' : ''}>
            <input
              type="radio"
              name={questionId}
              checked={answer === key}
              disabled={readOnly}
              onChange={() => onChange(key)}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

export function ClusterSubtypeRenderer({
  subtype,
  passage,
  stem,
  options = [],
  answer,
  onChange,
  questionId,
  readOnly = false,
}: Props) {
  const [order, setOrder] = useState<string[]>(() =>
    options.length ? [...options] : [],
  );

  if (subtype === 'reorder' && options.length) {
    const move = (from: number, to: number) => {
      if (to < 0 || to >= order.length) return;
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setOrder(next);
      onChange(next.map((o) => o.charAt(0)).join(''));
    };
    return (
      <div className="cluster-reorder">
        {passage && (
          <div className="passage">
            <RichTextContent content={passage} />
          </div>
        )}
        <p className="cluster-hint">Sắp xếp các mục theo đúng thứ tự (dùng nút ↑↓):</p>
        <ol>
          {order.map((opt, i) => (
            <li key={opt} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ flex: 1 }}>{opt}</span>
              <button type="button" className="cbt-btn cbt-btn-outline" disabled={readOnly} onClick={() => move(i, i - 1)}>↑</button>
              <button type="button" className="cbt-btn cbt-btn-outline" disabled={readOnly} onClick={() => move(i, i + 1)}>↓</button>
            </li>
          ))}
        </ol>
        <McqOptions
          options={options}
          answer={answer}
          onChange={onChange}
          questionId={questionId}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (subtype === 'fill_gap' || subtype === 'fill_notice' || subtype === 'fill_flyer') {
    const gaps = (passage || stem || '').split(/(\{\{\d+\}\}|___+)/);
    return (
      <div className={`cluster-${subtype}`}>
        <div className="passage cluster-passage">
          {gaps.map((part, i) =>
            /^\{\{\d+\}\}$|___+/.test(part) ? (
              <select
                key={i}
                disabled={readOnly}
                value={(answer as Record<string, string>)?.[`g${i}`] ?? ''}
                onChange={(e) =>
                  onChange({ ...(answer as Record<string, string>), [`g${i}`]: e.target.value })
                }
                style={{ margin: '0 4px' }}
              >
                <option value="">--</option>
                {options.map((o) => (
                  <option key={o} value={o.charAt(0)}>{o}</option>
                ))}
              </select>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
        {stem && <div className="stem"><RichTextContent content={stem} /></div>}
        <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} />
      </div>
    );
  }

  return (
    <div className={`cluster-${subtype ?? 'reading'}`}>
      {passage && (
        <div className="passage">
          <RichTextContent content={passage} />
        </div>
      )}
      {stem && (
        <div className="stem">
          <RichTextContent content={stem} />
        </div>
      )}
      <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} />
    </div>
  );
}
