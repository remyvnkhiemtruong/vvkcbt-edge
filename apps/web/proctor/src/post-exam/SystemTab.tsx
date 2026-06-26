import { useEffect, useState } from 'react';
import { formatHealthCheckValue, vi } from '@shared/index';

const API = import.meta.env.VITE_API_URL || '';

export function SystemTab({ token: _token }: { token: string }) {
  const [health, setHealth] = useState<{ status: string; checks?: Record<string, string> } | null>(
    null,
  );

  useEffect(() => {
    fetch(`${API}/api/infra/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  const ok = health?.status === 'ok';
  const labels = vi.proctor.system.checkLabels;

  return (
    <div className="proctor-tab-panel">
      <h3>{vi.proctor.system.title}</h3>
      <div className="ha-diagram">
        <div className={`ha-node ${ok ? 'ha-node--ok' : 'ha-node--down'}`}>
          <div>🖥</div>
          <strong>{vi.proctor.system.edgeApi}</strong>
          <span className={`ha-badge ${ok ? 'ha-badge--ok' : 'ha-badge--down'}`}>
            {ok ? vi.proctor.system.online : vi.proctor.system.degraded}
          </span>
        </div>
      </div>
      {health?.checks && (
        <ul className="proctor-system-checks">
          {Object.entries(health.checks).map(([key, val]) => {
            const checkOk =
              val === 'ok' || String(val).startsWith('ok') || String(val).startsWith('skipped');
            return (
              <li key={key}>
                <span className="proctor-system-checks__label">{labels[key] ?? key}</span>
                <span className={checkOk ? 'proctor-system-checks__ok' : 'proctor-system-checks__err'}>
                  {formatHealthCheckValue(key, String(val))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
