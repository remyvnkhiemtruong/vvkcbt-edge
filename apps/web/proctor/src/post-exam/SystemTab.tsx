import { useEffect, useState } from 'react';
import { vi } from '@shared/index';

const API = import.meta.env.VITE_API_URL || '';

const CHECK_LABELS: Record<string, string> = {
  database: 'Cơ sở dữ liệu',
  disk: 'Ổ đĩa',
  memory: 'Bộ nhớ',
};

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
        <ul style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#cbd5e1', listStyle: 'none', padding: 0 }}>
          {Object.entries(health.checks).map(([key, val]) => {
            const checkOk =
              val === 'ok' || String(val).startsWith('ok') || String(val).startsWith('skipped');
            return (
              <li key={key} style={{ marginBottom: '0.35rem' }}>
                {CHECK_LABELS[key] ?? key}:{' '}
                <span style={{ color: checkOk ? '#86efac' : '#fca5a5' }}>
                  {checkOk ? vi.proctor.system.checkOk : String(val)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="admin-hint" style={{ marginTop: '1rem' }}>
        {vi.proctor.system.composerHint}
      </p>

      <section style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 0.5rem' }}>Góc giáo viên / vận hành</h4>
        <ul className="admin-hint" style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          <li>Kiểm tra Puppeteer PDF: tab Biên bản phòng → tải PDF thử; nếu lỗi dùng Excel.</li>
          <li>Bảng điểm tự động: bật mặc định (`VITE_AUTO_SCOREBOARD` / localStorage).</li>
          <li>Phúc khảo (G4): mẫu Phụ lục IV TT24/2024 — triển khai khi Sở yêu cầu.</li>
          <li>Ký số GT trên biên bản: dùng chữ ký tablet trong tab Biên bản phòng.</li>
        </ul>
      </section>
    </div>
  );
}
