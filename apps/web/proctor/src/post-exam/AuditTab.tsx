import { useEffect, useState } from 'react';
import { CbtDataTable, CbtStatusBadge } from '@shared/index';
import type { CbtColumn } from '@shared/index';
import { proctorApi } from '../api';

interface AuditRow {
  id: string;
  eventType: string;
  detail: string;
  clientIp?: string;
  createdAt: string;
}

export function AuditTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    proctorApi<AuditRow[]>(`/post-exam/audit/${examSessionId}`, token)
      .then(setRows)
      .catch(console.error);
  }, [examSessionId, token]);

  const exportCsv = () => {
    const header = 'Thời gian,Sự kiện,Chi tiết,IP Trạm\n';
    const body = rows
      .map((r) => {
        const t = new Date(r.createdAt).toLocaleTimeString('vi-VN');
        return `${t},${r.eventType},${r.detail},${r.clientIp || ''}`;
      })
      .join('\n');
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${examSessionId}.csv`;
    a.click();
  };

  const columns: CbtColumn<AuditRow>[] = [
    {
      key: 'time',
      header: 'Thời gian',
      render: (r) => new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour12: false }),
    },
    { key: 'event', header: 'Sự kiện', render: (r) => <CbtStatusBadge type={r.eventType} /> },
    { key: 'detail', header: 'Chi tiết', render: (r) => r.detail },
    { key: 'ip', header: 'IP', render: (r) => r.clientIp || '—' },
  ];

  return (
    <div className="proctor-tab-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Nhật ký thao tác</h3>
        <button type="button" className="cbt-btn cbt-btn-primary" onClick={exportCsv}>
          Xuất CSV
        </button>
      </div>
      <CbtDataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
    </div>
  );
}
