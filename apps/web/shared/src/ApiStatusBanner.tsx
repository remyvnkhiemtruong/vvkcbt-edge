import { useCallback, useEffect, useState } from 'react';

export interface HealthResponse {
  status: 'ok' | 'degraded' | string;
  timestamp?: string;
  checks?: Record<string, string>;
  clientIp?: string;
}

const API_BASE = typeof import.meta !== 'undefined'
  ? ((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '')
  : '';

/**
 * Banner khi API Edge không phản hồi — poll /api/infra/health.
 */
export function ApiStatusBanner({ pollMs = 10000 }: { pollMs?: number }) {
  const [down, setDown] = useState(false);
  const [checking, setChecking] = useState(false);
  const [detail, setDetail] = useState('');

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch(`${API_BASE}/api/infra/health`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as HealthResponse;
      const degraded = d.status !== 'ok';
      setDown(degraded);
      setDetail(
        degraded && d.checks
          ? Object.entries(d.checks)
              .filter(([, v]) => v === 'error')
              .map(([k]) => k)
              .join(', ')
          : '',
      );
    } catch {
      setDown(true);
      setDetail('Không kết nối được máy chủ');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = window.setInterval(check, pollMs);
    return () => window.clearInterval(id);
  }, [check, pollMs]);

  if (!down) return null;

  return (
    <div
      role="alert"
      style={{
        background: '#fef2f2',
        color: '#991b1b',
        padding: '0.5rem 1rem',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span>
        <strong>Máy chủ thi chưa sẵn sàng.</strong>
        {detail ? ` (${detail})` : ''} Kiểm tra API / mạng LAN.
      </span>
      <button
        type="button"
        onClick={check}
        disabled={checking}
        style={{
          padding: '0.25rem 0.75rem',
          border: '1px solid #b91c1c',
          background: '#fff',
          color: '#b91c1c',
          borderRadius: 4,
          cursor: checking ? 'wait' : 'pointer',
          fontSize: '0.8rem',
        }}
      >
        {checking ? 'Đang thử…' : 'Thử lại'}
      </button>
    </div>
  );
}
