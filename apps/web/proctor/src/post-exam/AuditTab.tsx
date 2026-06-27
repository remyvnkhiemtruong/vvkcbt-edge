import { useEffect, useState } from 'react';
import { CbtDataTable, CbtStatusBadge } from '@shared/index';
import type { CbtColumn } from '@shared/index';
import { formatAuditDetail, formatAuditEvent } from '@shared/index';
import { proctorApi } from '../api';

interface AuditRow {
  id: string;
  eventType: string;
  detail: string;
  actor: string;
  actorRole?: 'student' | 'proctor' | 'system';
  clientIp?: string;
  createdAt: string;
}

function actorClass(role?: AuditRow['actorRole']): string {
  if (role === 'proctor') return 'proctor-audit-actor proctor-audit-actor--proctor';
  if (role === 'student') return 'proctor-audit-actor proctor-audit-actor--student';
  return 'proctor-audit-actor proctor-audit-actor--system';
}

export function AuditTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    proctorApi<AuditRow[]>(`/post-exam/audit/${examSessionId}`, token)
      .then(setRows)
      .catch(console.error);
  }, [examSessionId, token]);

  const exportCsv = () => {
    const header = 'Thời gian,Người thao tác,Sự kiện,Chi tiết,IP trạm\n';
    const body = rows
      .map((r) => {
        const t = new Date(r.createdAt).toLocaleString('vi-VN', { hour12: false });
        const event = formatAuditEvent(r.eventType);
        const detail = formatAuditDetail(r.eventType, r.detail).replace(/"/g, '""');
        const actor = (r.actor || '—').replace(/"/g, '""');
        return `${t},"${actor}","${event}","${detail}",${r.clientIp || ''}`;
      })
      .join('\n');
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nhat-ky-${examSessionId}.csv`;
    a.click();
  };

  const columns: CbtColumn<AuditRow>[] = [
    {
      key: 'time',
      header: 'Thời gian',
      render: (r) =>
        new Date(r.createdAt).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
    },
    {
      key: 'actor',
      header: 'Người thao tác',
      render: (r) => <span className={actorClass(r.actorRole)}>{r.actor || '—'}</span>,
    },
    { key: 'event', header: 'Sự kiện', render: (r) => <CbtStatusBadge type={r.eventType} /> },
    {
      key: 'detail',
      header: 'Chi tiết',
      render: (r) => (
        <span className="proctor-audit-detail">{formatAuditDetail(r.eventType, r.detail)}</span>
      ),
    },
    { key: 'ip', header: 'IP trạm', render: (r) => r.clientIp || '—' },
  ];

  return (
    <div className="proctor-tab-panel">
      <div className="proctor-tab-header">
        <h3>Nhật ký thao tác</h3>
        <button type="button" className="cbt-btn cbt-btn-primary" onClick={exportCsv}>
          Xuất CSV
        </button>
      </div>
      <div className="proctor-table-wrap">
        <CbtDataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </div>
    </div>
  );
}
