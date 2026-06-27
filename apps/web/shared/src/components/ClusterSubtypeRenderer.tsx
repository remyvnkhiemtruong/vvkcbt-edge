import { Fragment } from 'react';
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
  instruction?: string;
  passage?: string;
  sentences?: string[];
  stem?: string;
  options?: string[];
  answer: unknown;
  onChange: (answer: unknown) => void;
  questionId: string;
  readOnly?: boolean;
  /** Ẩn hướng dẫn / đoạn văn chung (hiển thị ở panel trên). */
  hideSharedContext?: boolean;
}

/** Chỉ hiển thị tiêu đề + đoạn văn chung — dùng ở panel ngữ cảnh soạn đề / thi. */
export function ClusterContextPreview({
  instruction,
  passage,
}: {
  instruction?: string;
  passage?: string;
}) {
  return <ClusterPassageBlock instruction={instruction} passage={passage} />;
}

function ClusterPassageBlock({ instruction, passage }: { instruction?: string; passage?: string }) {
  if (!instruction && !passage) return null;
  return (
    <div className="passage">
      {instruction ? (
        <p className="exam-passage-instruction">
          <RichTextContent content={instruction} />
        </p>
      ) : null}
      {passage ? <RichTextContent content={passage} /> : null}
    </div>
  );
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
  instruction,
  passage,
  sentences = [],
  stem,
  options = [],
  answer,
  onChange,
  questionId,
  readOnly = false,
  hideSharedContext = false,
}: Props) {
  if (subtype === 'reorder' && options.length) {
    const sentenceList = sentences.filter((s) => s.replace(/^[a-e]\.\s*/i, '').trim().length > 0);
    return (
      <div className="cluster-reorder">
        {!hideSharedContext && instruction ? (
          <p className="exam-passage-instruction">
            <RichTextContent content={instruction} />
          </p>
        ) : null}
        {sentenceList.length > 0 && (
          <ul className="cluster-reorder__sentences">
            {sentenceList.map((s, i) => (
              <li key={i} className="cluster-reorder__sentence">
                <RichTextContent content={s} />
              </li>
            ))}
          </ul>
        )}
        <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} readOnly={readOnly} />
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
        {!hideSharedContext && instruction ? (
          <p className="exam-passage-instruction">
            <RichTextContent content={instruction} />
          </p>
        ) : null}
        {!hideSharedContext ? (
          <GapPassage
            text={passageText}
            options={options}
            answer={answer}
            onChange={onChange}
            readOnly={readOnly}
            className={layoutClass}
          />
        ) : null}
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
      {!hideSharedContext ? <ClusterPassageBlock instruction={instruction} passage={passage} /> : null}
      {stem && (
        <div className="stem">
          <RichTextContent content={stem} />
        </div>
      )}
      <McqOptions options={options} answer={answer} onChange={onChange} questionId={questionId} readOnly={readOnly} />
    </div>
  );
}
