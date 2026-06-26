import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export function SystemTab({ token: _token }: { token: string }) {
  const [health, setHealth] = useState<{ status: string; checks?: Record<string, unknown> } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/infra/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  const ok = health?.status === 'ok';

  return (
    <div className="proctor-tab-panel">
      <h3>Hệ thống</h3>
      <div className="ha-diagram">
        <div className={`ha-node ${ok ? 'ha-node--ok' : 'ha-node--down'}`}>
          <div>🖥</div>
          <strong>Edge API</strong>
          <span className={`ha-badge ${ok ? 'ha-badge--ok' : 'ha-badge--down'}`}>
            {ok ? '[ONLINE]' : '[OFFLINE / DEGRADED]'}
          </span>
        </div>
      </div>
      {health?.checks && (
        <pre style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
          {JSON.stringify(health.checks, null, 2)}
        </pre>
      )}
      <p className="admin-hint" style={{ marginTop: '1rem' }}>
        Soạn gói thi bằng <strong>vnu-composer</strong> (repo riêng), xuất ZIP và copy USB sang máy Edge.
      </p>
    </div>
  );
}
