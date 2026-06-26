import { useEffect, useState } from 'react';
import { proctorFetch } from '../api';

interface CheckItem {
  item: string;
  ok: boolean;
  detail?: string;
}

export function PreflightChecklist({ token }: { token: string }) {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const list: CheckItem[] = [];
    try {
      const healthRes = await proctorFetch('/infra/health', token);
      const health = await healthRes.json();
      list.push({
        item: 'API Edge',
        ok: health.status === 'ok' || health.status === 'degraded',
        detail: health.status,
      });
      for (const [k, v] of Object.entries(health.checks ?? {}) as [string, string][]) {
        list.push({
          item: k,
          ok: !String(v).includes('error'),
          detail: String(v),
        });
      }
    } catch {
      list.push({ item: 'API Edge', ok: false, detail: 'Không kết nối' });
    }

    try {
      const statusRes = await proctorFetch('/proctor/packages/status', token);
      const status = await statusRes.json();
      list.push({
        item: 'Ca thi đã import',
        ok: !!status.examSessionId,
        detail: status.examSessionId ? status.sessionName ?? status.packageId : 'Chưa import ZIP',
      });
    } catch {
      list.push({ item: 'Ca thi', ok: false, detail: 'Lỗi kiểm tra' });
    }

    setItems(list);
    setBusy(false);
  };

  useEffect(() => {
    run();
  }, [token]);

  const allOk = items.length > 0 && items.every((i) => i.ok);

  return (
    <div className="proctor-preflight" style={{ marginTop: '1rem' }}>
      <h3>Checklist trước giờ thi</h3>
      <ul style={{ fontSize: '0.85rem', color: '#e2e8f0', listStyle: 'none', padding: 0 }}>
        {items.map((c) => (
          <li key={c.item} style={{ marginBottom: '0.35rem', color: c.ok ? '#86efac' : '#fca5a5' }}>
            {c.ok ? '✓' : '✗'} {c.item}
            {c.detail ? ` — ${c.detail}` : ''}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: '0.8rem', color: allOk ? '#86efac' : '#fca5a5' }}>
        {allOk ? 'Sẵn sàng giám sát' : 'Hoàn thành các mục ✗ trước khi mở đề'}
      </p>
      <button type="button" className="cbt-btn cbt-btn-outline" onClick={run} disabled={busy}>
        {busy ? 'Đang kiểm tra…' : 'Chạy lại checklist'}
      </button>
    </div>
  );
}
