import { useCallback, useEffect, useState } from 'react';
import { vi } from '@shared/index';
import { handleProctorApiError, proctorApi, SESSION_EXPIRED_MSG } from '../api';

export interface SubjectScheduleRow {
  subjectCode: string;
  nameVi: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'scheduled' | 'open' | 'locked' | 'completed' | 'partial';
  counts: { scheduled: number; open: number; locked: number; completed: number; total: number };
  canOpen: boolean;
}

const STATUS_LABEL: Record<SubjectScheduleRow['status'], string> = {
  scheduled: 'Chưa mở',
  open: 'Đã mở đề',
  partial: 'Mở một phần',
  locked: 'Đã khóa',
  completed: 'Đã xong',
};

function formatSlotTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SubjectOpenBar({
  token,
  examSessionId,
  refreshKey = 0,
  onSessionExpired,
  onOpened,
  compact = false,
}: {
  token: string;
  examSessionId: string;
  refreshKey?: number;
  onSessionExpired?: () => void;
  onOpened?: (subjectCode: string) => void;
  compact?: boolean;
}) {
  const [rows, setRows] = useState<SubjectScheduleRow[]>([]);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!examSessionId) return;
    try {
      const data = await proctorApi<{ subjects: SubjectScheduleRow[] }>(
        `/proctor/sessions/${examSessionId}/subject-schedule`,
        token,
      );
      setRows(data.subjects ?? []);
    } catch (err) {
      if (err instanceof Error && err.message === SESSION_EXPIRED_MSG) onSessionExpired?.();
    }
  }, [examSessionId, token, onSessionExpired]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openSubject = async (row: SubjectScheduleRow) => {
    if (!row.canOpen || busyCode) return;
    const label = row.nameVi;
    if (!window.confirm(`Mở đề môn ${label}?\n\nThí sinh có thể bắt đầu làm bài sau khi đến giờ và đã xác nhận nội quy.`)) {
      return;
    }
    setBusyCode(row.subjectCode);
    setMsg('');
    try {
      const res = await proctorApi<{ opened: number; subjectCode: string }>(
        `/proctor/sessions/${examSessionId}/subjects/${encodeURIComponent(row.subjectCode)}/open`,
        token,
        { method: 'POST' },
      );
      setMsg(`Đã mở đề ${label} (${res.opened} thí sinh)`);
      onOpened?.(row.subjectCode);
      await load();
    } catch (err) {
      setMsg(handleProctorApiError(err, onSessionExpired));
    } finally {
      setBusyCode(null);
    }
  };

  if (!rows.length) return null;

  if (compact) {
    return (
      <div className="proctor-open-bar proctor-open-bar--compact">
        <span className="proctor-open-bar__title">{vi.proctor.scheduleTitle}</span>
        <div className="proctor-open-bar__items">
          {rows.map((row) => (
            <div key={row.subjectCode} className="proctor-open-bar__item">
              <span className="proctor-open-bar__meta">
                <strong>{row.nameVi}</strong>
                <span className={`proctor-open-bar__status proctor-open-bar__status--${row.status}`}>
                  {STATUS_LABEL[row.status]}
                </span>
                {row.scheduledStart && (
                  <span className="proctor-open-bar__time">{formatSlotTime(row.scheduledStart)}</span>
                )}
              </span>
              {row.canOpen ? (
                <button
                  type="button"
                  className="cbt-btn cbt-btn-primary cbt-btn-sm"
                  disabled={!!busyCode}
                  onClick={() => openSubject(row)}
                >
                  {busyCode === row.subjectCode ? 'Đang mở…' : vi.proctor.openPaper}
                </button>
              ) : (
                <span className="proctor-open-bar__done">
                  {row.status === 'open' || row.status === 'partial' ? '✓' : '—'}
                </span>
              )}
            </div>
          ))}
        </div>
        {msg && <p className="proctor-open-bar__msg">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="proctor-panel proctor-open-schedule">
      <h3>{vi.proctor.scheduleTitle}</h3>
      <p className="proctor-schedule-meta">{vi.proctor.releaseHint}</p>
      <div className="proctor-table-wrap proctor-schedule-table">
        <table className="cbt-table">
          <thead>
            <tr>
              <th>Môn</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th>Trạng thái</th>
              <th>Thí sinh</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subjectCode}>
                <td>{row.nameVi}</td>
                <td>{formatSlotTime(row.scheduledStart)}</td>
                <td>{formatSlotTime(row.scheduledEnd)}</td>
                <td>
                  <span className={`proctor-open-bar__status proctor-open-bar__status--${row.status}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td>
                  {row.counts.open}/{row.counts.total} mở · {row.counts.completed} nộp
                </td>
                <td>
                  {row.canOpen ? (
                    <button
                      type="button"
                      className="cbt-btn cbt-btn-primary cbt-btn-sm"
                      disabled={!!busyCode}
                      onClick={() => openSubject(row)}
                    >
                      {busyCode === row.subjectCode ? 'Đang mở…' : vi.proctor.openPaper}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="proctor-open-bar__msg">{msg}</p>}
    </div>
  );
}
