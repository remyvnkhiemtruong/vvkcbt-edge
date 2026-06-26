import { Fragment, useState } from 'react';
import { RichTextContent } from './RichTextContent';
import { splitPassageGaps } from '../utils/rich-text-parser';

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
            <RichTextContent content={opt} />
          </label>
        );
      })}
    </div>
  );
}

function GapPassage({
  text,
  options,
  answer,
  onChange,
  readOnly,
  className,
}: {
  text: string;
  options: string[];
  answer: unknown;
  onChange: (a: unknown) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const segments = splitPassageGaps(text);
  return (
    <div className={`passage cluster-passage ${className ?? ''}`}>
      {segments.map((seg, i) => {
        if (seg.kind === 'gap') {
          const gapKey = `g${seg.gapIndex}`;
          return (
            <select
              key={`gap-${i}`}
              disabled={readOnly}
              className="cluster-gap-select"
              value={(answer as Record<string, string>)?.[gapKey] ?? ''}
              onChange={(e) =>
                onChange({ ...(answer as Record<string, string>), [gapKey]: e.target.value })
              }
            >
              <option value="">--</option>
              {options.map((o) => (
                <option key={o} value={o.charAt(0)}>
                  {o}
                </option>
              ))}
            </select>
          );
        }
        return (
          <Fragment key={`t-${i}`}>
            <RichTextContent content={seg.value} />
          </Fragment>
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
        <ol className="cluster-reorder__list">
          {order.map((opt, i) => (
            <li key={`${opt}-${i}`} className="cluster-reorder__item">
              <span className="cluster-reorder__text">
                <RichTextContent content={opt} />
              </span>
              <button type="button" className="cbt-btn cbt-btn-outline" disabled={readOnly} onClick={() => move(i, i - 1)}>↑</button>
              <button type="button" className="cbt-btn cbt-btn-outline" disabled={readOnly} onClick={() => move(i, i + 1)}>↓</button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (subtype === 'fill_gap' || subtype === 'fill_notice' || subtype === 'fill_flyer') {
    const passageText = passage || stem || '';
    const layoutClass =
      subtype === 'fill_notice'
        ? 'cluster-fill_notice-layout'
        : subtype === 'fill_flyer'
          ? 'cluster-fill_flyer-layout'
          : 'cluster-fill_gap-layout';

    return (
      <div className={`cluster-${subtype}`}>
        <GapPassage
          text={passageText}
          options={options}
          answer={answer}
          onChange={onChange}
          readOnly={readOnly}
          className={layoutClass}
        />
        {stem && passage && (
          <div className="stem">
            <RichTextContent content={stem} />
          </div>
        )}
        <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} readOnly={readOnly} />
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
      <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} readOnly={readOnly} />
    </div>
  );
}
