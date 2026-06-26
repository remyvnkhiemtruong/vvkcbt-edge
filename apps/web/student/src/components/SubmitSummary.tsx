export function countAnswered(
  questions: Array<{ id: string }>,
  answers: Record<string, unknown>,
): { answered: number; total: number; unanswered: number } {
  const total = questions.length;
  let answered = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a === undefined || a === null || a === '') continue;
    if (typeof a === 'object' && !Array.isArray(a) && Object.keys(a as object).length === 0) continue;
    if (Array.isArray(a) && a.length === 0) continue;
    answered++;
  }
  return { answered, total, unanswered: total - answered };
}

export function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface SubmitSummaryPanelProps {
  answered: number;
  total: number;
  remainingSec: number;
}

export function SubmitSummaryPanel({ answered, total, remainingSec }: SubmitSummaryPanelProps) {
  const unanswered = total - answered;
  return (
    <div
      role="dialog"
      aria-labelledby="submit-summary-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(15,23,42,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem 1.5rem',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h3 id="submit-summary-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
          Xác nhận nộp bài
        </h3>
        <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', lineHeight: 1.7, fontSize: '0.95rem' }}>
          <li>
            Đã làm: <strong>{answered}</strong> / {total} câu
          </li>
          <li>
            Chưa trả lời: <strong>{unanswered}</strong> câu
          </li>
          <li>
            Thời gian còn lại: <strong>{formatRemaining(remainingSec)}</strong>
          </li>
        </ul>
        {unanswered > 0 && (
          <p style={{ color: '#b45309', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            Bạn còn câu chưa làm — hãy kiểm tra lại trước khi nộp.
          </p>
        )}
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
          Nhấn &quot;Xác nhận nộp&quot; lần nữa để gửi bài thi.
        </p>
      </div>
    </div>
  );
}
