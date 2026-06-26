import { formatAuditEvent } from '../i18n/maps';

type EventType = string;

const colors: Record<string, { color: string }> = {
  login: { color: '#4ade80' },
  submit: { color: '#60a5fa' },
  autosave: { color: '#94a3b8' },
  click: { color: '#93c5fd' },
  focus_violation: { color: '#f87171' },
  focus_lost: { color: '#fb923c' },
  proctor_action: { color: '#c084fc' },
  help_request: { color: '#fbbf24' },
  score_override: { color: '#f472b6' },
  LOGIN: { color: '#4ade80' },
  SUBMIT: { color: '#60a5fa' },
  VIOLATION: { color: '#f87171' },
};

export function CbtStatusBadge({ type }: { type: EventType }) {
  const key = type.toLowerCase();
  const style = colors[key] ?? colors[type] ?? { color: '#e2e8f0' };
  return (
    <span style={{ fontWeight: 600, color: style.color, fontSize: '0.88rem' }}>
      {formatAuditEvent(type)}
    </span>
  );
}
