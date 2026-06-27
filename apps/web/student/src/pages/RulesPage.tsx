import { useState, useEffect, useCallback } from 'react';
import { CbtCard, CbtBrandLogo, vi, isProductionUi, isRunningInSEB, requiresSebLock, translateApiError } from '@shared/index';
import { studentApi } from '../api';

interface Props {
  onAccepted: () => void;
}

const RULES = [
  'Thí sinh không được rời khỏi màn hình thi trong quá trình làm bài.',
  'Không sử dụng tài liệu, thiết bị điện tử hoặc trao đổi với người khác.',
  'Hệ thống tự động lưu bài làm mỗi 3 giây; vi phạm focus quá 3 lần sẽ bị báo giám thị.',
  'Khi hết giờ làm bài, bài thi sẽ được nộp tự động.',
  'Đồng hồ làm bài chỉ chạy sau khi bạn bấm «Bắt đầu làm bài» — có thể làm hết thời gian quy định kể cả khi đã quá giờ kết thúc ca (nếu đã bắt đầu trong ca).',
];

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
      checks.push({ ok: true, text: `Độ phân giải: ${w}x${h} — OK` });
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

  if (results.length === 0) return <p>Đang quét hệ thống...</p>;

  return (
    <div
      className="diagnostic-modal"
      style={{ border: failed ? '2px solid var(--cbt-danger)' : '1px solid var(--cbt-border)' }}
    >
      <h3>{vi.diagnostic.title}</h3>
      <hr />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((r, i) => (
          <li
            key={i}
            style={{
              padding: '0.5rem',
              marginBottom: '0.35rem',
              background: r.fail || !r.ok ? 'var(--cbt-danger-bg)' : 'transparent',
              color: r.fail || !r.ok ? 'var(--cbt-danger)' : 'var(--cbt-success)',
            }}
          >
            [{r.ok ? '✓' : '✗'}] {r.text}
          </li>
        ))}
      </ul>
      {failed && (
        <button
          type="button"
          className="cbt-btn cbt-btn-danger"
          style={{ width: '100%', marginTop: '1rem' }}
          onClick={() => window.alert('Đã gửi yêu cầu đổi máy tới giám thị. Vui lòng chờ hỗ trợ.')}
        >
          {vi.diagnostic.requestChange}
        </button>
      )}
    </div>
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
      await studentApi.startExam();
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
    <div className="rules-page">
      {!production && (
        <div className="rules-page__feature">
          <h1>TÍNH NĂNG 2–3. NỘI QUY & PHÒNG CHỜ</h1>
          <p>{vi.subtitle}</p>
        </div>
      )}
      <CbtCard>
        <div className="rules-page__brand">
          <CbtBrandLogo
            variant="login"
            size={72}
            showSchoolName
            layout="stack"
            align="center"
          />
        </div>
        <h1 style={{ color: 'var(--cbt-primary)', textAlign: 'center' }}>{vi.rules.title}</h1>
        <ul style={{ lineHeight: 1.7, margin: '1rem 0' }}>
          {RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {!diagOk && <DiagnosticGate onPass={() => setDiagOk(true)} />}
        {diagOk && (
          <>
            <label className="rules-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {vi.rules.accept}
            </label>
            <button
              type="button"
              className="cbt-btn cbt-btn-primary"
              style={{ width: '100%' }}
              disabled={!checked || starting}
              onClick={handleStart}
            >
              {starting ? 'Đang mở đề…' : vi.rules.start}
            </button>
            {startError && <p className="cbt-error-text" style={{ marginTop: '0.75rem' }}>{startError}</p>}
          </>
        )}
      </CbtCard>
      {!production && (
        <footer className="rules-page__footer">
          <span>Trang 2/24</span>
        </footer>
      )}
    </div>
  );
}
