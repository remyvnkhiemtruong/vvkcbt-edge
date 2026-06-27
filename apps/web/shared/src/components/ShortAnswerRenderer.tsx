import {
  SHORT_ANSWER_HINT,
  SHORT_ANSWER_MAX_LEN,
  filterShortAnswerInput,
} from '@vnu/shared-types';

interface Props {
  answer: unknown;
  onChange: (value: string) => void;
  readOnly?: boolean;
  inputId?: string;
}

export function ShortAnswerRenderer({ answer, onChange, readOnly = false, inputId = 'short-answer-input' }: Props) {
  const value = typeof answer === 'string' ? answer : answer != null ? String(answer) : '';

  const handleChange = (raw: string) => {
    onChange(filterShortAnswerInput(raw));
  };

  return (
    <div className="short-answer-box" onClick={(e) => e.stopPropagation()}>
      <label className="short-answer-box__label" htmlFor={inputId}>
        Đáp án
      </label>
      <input
        id={inputId}
        type="text"
        className="short-answer-box__input"
        value={value}
        readOnly={readOnly}
        disabled={readOnly}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        maxLength={SHORT_ANSWER_MAX_LEN}
        placeholder="...."
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <p className="short-answer-box__hint">{SHORT_ANSWER_HINT}</p>
    </div>
  );
}
