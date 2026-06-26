import { vi } from '../i18n/vi';

interface ExamThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ExamThemeToggle({ isDark, onToggle }: ExamThemeToggleProps) {
  return (
    <button
      type="button"
      className="exam-icon-btn exam-icon-btn--theme"
      title={vi.exam.themeToggle}
      aria-label={vi.exam.themeToggle}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
