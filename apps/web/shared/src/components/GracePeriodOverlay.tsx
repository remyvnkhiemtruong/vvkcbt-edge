import { useEffect, useState } from 'react';
import { vi } from '../i18n/vi';

interface GracePeriodOverlayProps {
  visible: boolean;
  retryAttempt?: number;
}

export function GracePeriodOverlay({ visible, retryAttempt = 1 }: GracePeriodOverlayProps) {
  const [attempt, setAttempt] = useState(retryAttempt);

  useEffect(() => {
    if (!visible) return;
    setAttempt(retryAttempt);
    const id = setInterval(() => setAttempt((a) => a + 1), 8000);
    return () => clearInterval(id);
  }, [visible, retryAttempt]);

  if (!visible) return null;

  return (
    <div className="grace-overlay">
      <div className="grace-window">
        <header className="grace-header">
          <span>{vi.grace.systemStatus}</span>
          <span className="grace-header-sub">{vi.grace.networkError}</span>
        </header>
        <div className="grace-body">
          <CbtGraceCard attempt={attempt} />
        </div>
      </div>
      <style>{`
        .grace-overlay { position: fixed; inset: 0; z-index: 9999; background: var(--cbt-bg); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .grace-window { width: 100%; max-width: 720px; border-radius: var(--cbt-radius); overflow: hidden; box-shadow: var(--cbt-shadow); }
        .grace-header { display: flex; justify-content: space-between; padding: 0.85rem 1.25rem; background: var(--cbt-navy); color: #fff; font-weight: 700; text-transform: uppercase; }
        .grace-header-sub { font-size: 0.8rem; color: #94a3b8; font-weight: 400; text-transform: none; }
        .grace-body { background: var(--cbt-grace-bg); padding: 2rem 1.5rem; }
      `}</style>
    </div>
  );
}

function CbtGraceCard({ attempt }: { attempt: number }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '2px solid var(--cbt-grace-border)',
        borderRadius: 'var(--cbt-radius)',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
      <h2 style={{ color: '#92400e', margin: '0 0 1rem', fontSize: '1.5rem' }}>{vi.grace.title}</h2>
      <p style={{ margin: '0.5rem 0', color: '#78350f' }}>{vi.grace.line1}</p>
      <p style={{ margin: '0.5rem 0 1.5rem', color: '#78350f' }}>{vi.grace.line2}</p>
      <div
        style={{
          background: '#fef08a',
          borderRadius: 'var(--cbt-radius-sm)',
          padding: '0.85rem 1rem',
          fontWeight: 600,
          color: '#713f12',
        }}
      >
        {vi.grace.retry(attempt)}
      </div>
    </div>
  );
}
