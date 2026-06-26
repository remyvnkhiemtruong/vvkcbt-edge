type EventType = 'LOGIN' | 'ANSWER' | 'CHANGE' | 'VIOLATION' | string;

const colors: Record<string, { color: string }> = {
  LOGIN: { color: '#16a34a' },
  ANSWER: { color: '#2563eb' },
  CHANGE: { color: '#d97706' },
  VIOLATION: { color: '#dc2626' },
};

export function CbtStatusBadge({ type }: { type: EventType }) {
  const style = colors[type] ?? { color: 'var(--cbt-text)' };
  return (
    <span style={{ fontWeight: 700, color: style.color, fontSize: '0.85rem' }}>{type}</span>
  );
}
