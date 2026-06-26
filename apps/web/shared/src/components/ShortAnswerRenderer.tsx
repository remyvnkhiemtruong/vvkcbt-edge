interface Props {
  answer: unknown;
  onChange: (value: string) => void;
  readOnly?: boolean;
  inputId?: string;
}

const MAX_LEN = 4;

/** Cho phép: số nguyên, thập phân, âm, thập phân âm (tối đa 4 ký tự). */
function filterShortAnswerInput(raw: string): string {
  let s = raw.replace(/[^\d.,\-]/g, '');
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const sepIdx = s.search(/[.,]/);
  if (sepIdx >= 0) {
    const sep = s[sepIdx];
    const intPart = s.slice(0, sepIdx).replace(/[.,]/g, '');
    const fracPart = s.slice(sepIdx + 1).replace(/[.,]/g, '');
    s = intPart + sep + fracPart;
  }

  if (negative) s = `-${s}`;
  return s.slice(0, MAX_LEN);
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
        maxLength={MAX_LEN}
        placeholder="...."
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <p className="short-answer-box__hint">
        Nhập từ bàn phím (tối đa 4 ký tự): số nguyên, thập phân, số âm — dùng dấu chấm hoặc phẩy (vd: -2,5)
      </p>
    </div>
  );
}
