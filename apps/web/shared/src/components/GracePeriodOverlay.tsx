import { vi } from '../i18n/vi';

interface GracePeriodOverlayProps {
  visible: boolean;
  retryAttempt?: number;
}

export function GracePeriodOverlay({ visible, retryAttempt = 1 }: GracePeriodOverlayProps) {
  if (!visible) return null;

  return (
    <div className="grace-overlay">
      <div className="grace-window">
        <header className="grace-header">
          <span>{vi.grace.systemStatus}</span>
          <span className="grace-header-sub">{vi.grace.networkError}</span>
        </header>
        <div className="grace-body">
          <div className="grace-card">
            <div className="grace-card__icon" aria-hidden>
              ⏳
            </div>
            <h2 className="grace-card__title">{vi.grace.title}</h2>
            <p className="grace-card__text">{vi.grace.line1}</p>
            <p className="grace-card__text">{vi.grace.line2}</p>
            <div className="grace-card__retry">{vi.grace.retry(retryAttempt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
