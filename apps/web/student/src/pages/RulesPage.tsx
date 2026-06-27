import { useState, useEffect, useCallback } from 'react';
import { CbtBrandLogo, vi, isProductionUi, isRunningInSEB, requiresSebLock, translateApiError } from '@shared/index';
import { studentApi } from '../api';
import { useExamStore } from '../store';

interface Props {
  onAccepted: () => void;
}

const RULES: { icon: 'screen' | 'shield' | 'save' | 'timer' | 'clock'; text: string }[] = [
  {
    icon: 'screen',
    text: 'Thí sinh không được rời khỏi màn hình thi trong quá trình làm bài.',
  },
  {
    icon: 'shield',
    text: 'Không sử dụng tài liệu, thiết bị điện tử hoặc trao đổi với người khác.',
  },
  {
    icon: 'save',
    text: 'Hệ thống tự động lưu bài làm mỗi 3 giây.',
  },
  {
    icon: 'timer',
    text: 'Khi hết giờ làm bài, bài thi sẽ được nộp tự động.',
  },
  {
    icon: 'clock',
    text: 'Đồng hồ làm bài chỉ chạy sau khi bạn bấm «Bắt đầu làm bài».',
  },
];

function RuleIcon({ type }: { type: (typeof RULES)[number]['icon'] }) {
  const common = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'screen':
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'save':
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
      );
    case 'timer':
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" aria-hidden {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

function DiagnosticGate({ onPass }: { onPass: () => void }) {
  const [results, setResults] = useState<Array<{ ok: boolean; text: string; fail?: boolean }>>([]);
  const [failed, setFailed] = useState(false);
  const production = isProductionUi();
  const sebRequired = requiresSebLock();

  const runChecks = useCallback(async () => {
    const checks: Array<{ ok: boolean; text: string; fail?: boolean }> = [];
    try {
      localStorage.setItem('vnu_test', 'ok');
      const v = localStorage.getItem('vnu_test');
      localStorage.removeItem('vnu_test');
      checks.push({ ok: v === 'ok', text: vi.diagnostic.localStorageOk });
    } catch {
      checks.push({ ok: false, text: 'LocalStorage: Lỗi', fail: true });
    }

    const w = window.screen.width;
    const h = window.screen.height;
    if (w < 1024 || h < 768) {
      checks.push({ ok: false, text: vi.diagnostic.resolutionFail(w, h), fail: true });
    } else {
      checks.push({ ok: true, text: `Độ phân giải: ${w}×${h} — OK` });
    }

    const pingStart = performance.now();
    try {
      await fetch('/api/infra/health');
      const ms = Math.max(1, Math.round(performance.now() - pingStart));
      checks.push({ ok: true, text: vi.diagnostic.lanOk(ms) });
    } catch {
      checks.push({ ok: false, text: 'Mạng LAN: Không kết nối được', fail: true });
    }

    const inSeb = isRunningInSEB();
    if (sebRequired) {
      checks.push({
        ok: inSeb,
        text: inSeb
          ? 'Đang chạy trong Safe Exam Browser — OK'
          : 'Không phát hiện SEB — nên mở bằng Safe Exam Browser',
        fail: !inSeb,
      });
    } else {
      checks.push({
        ok: true,
        text: inSeb
          ? 'Safe Exam Browser — OK (chế độ trình duyệt cũng được hỗ trợ)'
          : 'Chế độ trình duyệt — dùng Chrome hoặc Edge toàn màn hình (F11 hoặc kiosk)',
      });
    }

    setResults(checks);
    const hasFail = checks.some((x) => x.fail || !x.ok);
    setFailed(hasFail);
    if (!hasFail) onPass();
  }, [onPass, production, sebRequired]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  if (results.length === 0) {
    return (
      <div className="rules-page__diag-bar" aria-live="polite">
        <span className="rules-page__spinner" aria-hidden />
        <span>Đang kiểm tra máy trạm…</span>
      </div>
    );
  }

  if (!failed) return null;

  return (
    <div className="rules-page__diagnostic rules-page__diagnostic--fail">
      <p className="rules-page__diagnostic-title">{vi.diagnostic.title}</p>
      <ul className="rules-page__diagnostic-list">
        {results.filter((r) => r.fail || !r.ok).map((r, i) => (
          <li key={i} className="rules-page__diagnostic-item rules-page__diagnostic-item--fail">
            <span className="rules-page__diagnostic-icon" aria-hidden>✗</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="cbt-btn cbt-btn-danger rules-page__diagnostic-action"
        onClick={() => window.alert('Đã gửi yêu cầu đổi máy tới giám thị. Vui lòng chờ hỗ trợ.')}
      >
        {vi.diagnostic.requestChange}
      </button>
    </div>
  );
}

function StartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function RulesPage({ onAccepted }: Props) {
  const [checked, setChecked] = useState(false);
  const [diagOk, setDiagOk] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const production = isProductionUi();

  const handleStart = async () => {
    if (!checked || !diagOk || starting) return;
    setStarting(true);
    setStartError('');
    try {
      const data = await studentApi.startExam();
      useExamStore.getState().setExam(data);
      onAccepted();
      if (!isRunningInSEB()) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          /* optional */
        }
      }
    } catch (err) {
      setStartError(err instanceof Error ? translateApiError(err.message) : 'Không bắt đầu được bài thi');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={`rules-page${!production ? ' rules-page--spec' : ''}`}>
      {!production && (
        <div className="rules-page__feature">
          <h1>TÍNH NĂNG 2–3. NỘI QUY & PHÒNG CHỜ</h1>
          <p>{vi.subtitle}</p>
        </div>
      )}

      <div className="rules-page__window">
        <div className="rules-page__topbar">
          <CbtBrandLogo variant="header" size={32} />
          <span className="rules-page__topbar-title">{vi.rules.title}</span>
        </div>

        <div className="rules-page__body">
          <p className="rules-page__lead">Đọc kỹ các quy định dưới đây trước khi vào phòng thi</p>

          <ol className="rules-page__list">
            {RULES.map((rule, i) => (
              <li key={i} className="rules-page__rule">
                <span className="rules-page__rule-num" aria-hidden>{i + 1}</span>
                <span className="rules-page__rule-icon" aria-hidden>
                  <RuleIcon type={rule.icon} />
                </span>
                <p className="rules-page__rule-text">{rule.text}</p>
              </li>
            ))}
          </ol>

          <div className="rules-page__footer-panel">
            {!diagOk && <DiagnosticGate onPass={() => setDiagOk(true)} />}

            <div className="rules-page__footer-actions">
              <label className={`rules-page__accept ${checked ? 'rules-page__accept--checked' : ''}`}>
                <input
                  type="checkbox"
                  className="rules-page__accept-input"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                <span className="rules-page__accept-box" aria-hidden />
                <span className="rules-page__accept-text">{vi.rules.accept}</span>
              </label>

              <button
                type="button"
                className="cbt-btn rules-page__start-btn"
                disabled={!checked || !diagOk || starting}
                onClick={handleStart}
              >
                {starting ? (
                  <>
                    <span className="rules-page__spinner rules-page__spinner--btn" aria-hidden />
                    Đang mở đề…
                  </>
                ) : (
                  <>
                    <StartIcon />
                    {vi.rules.start}
                  </>
                )}
              </button>
            </div>

            {startError && (
              <div className="rules-page__error-block">
                <p className="rules-page__error">{startError}</p>
                {(startError.includes('Chờ giám thị mở đề') ||
                  startError.includes('chờ giám thị mở đề')) && (
                  <p className="rules-page__error-hint">{vi.rules.waitProctorOpen}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!production && (
        <footer className="rules-page__footer">
          <span>Trang 2/24</span>
        </footer>
      )}
    </div>
  );
}
