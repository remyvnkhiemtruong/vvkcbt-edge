import { useEffect, useState } from 'react';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { proctorApi, downloadProctorFile } from '../api';

interface DashboardPreview {
  totalStudents: number;
  submitted: number;
  inExam: number;
  violations: number;
  offline: number;
  bySubject: Record<string, { submitted: number; open: number; locked: number }>;
}

export function ReportTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DashboardPreview | null>(null);
  const [toast, setToast] = useState<{ type: 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 6000);
  };

  useEffect(() => {
    proctorApi<DashboardPreview>(`/proctor/sessions/${examSessionId}/dashboard`, token)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [examSessionId, token]);

  const downloadReport = async () => {
    setBusy(true);
    try {
      const data = await proctorApi<{
        excelBase64: string;
        auditCsv: string;
        generatedAt: string;
      }>(`/proctor/sessions/${examSessionId}/report`, token);

      const excelBytes = Uint8Array.from(atob(data.excelBase64), (c) => c.charCodeAt(0));
      const excelBlob = new Blob([excelBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(excelBlob);
      a.download = 'kythi-master-ket-qua.xlsx';
      a.click();

      const csvBlob = new Blob(['\ufeff' + data.auditCsv], { type: 'text/csv;charset=utf-8' });
      const b = document.createElement('a');
      b.href = URL.createObjectURL(csvBlob);
      b.download = `audit-${examSessionId}.csv`;
      b.click();
      showToast('info', 'Đã tải báo cáo Excel và CSV.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Xuất báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proctor-tab-panel">
      {toast && (
        <div
          className={`proctor-toast proctor-toast--${toast.type}`}
          role="alert"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 6,
            marginBottom: '0.75rem',
            background: toast.type === 'error' ? '#fef2f2' : '#eff6ff',
            color: toast.type === 'error' ? '#b91c1c' : '#1d4ed8',
          }}
        >
          {toast.message}
        </div>
      )}
      <h3>Báo cáo & điểm</h3>
      <p className="admin-hint">
        Xuất gói phòng thi (ZIP) khi cần lưu kết quả ca (Excel, nhật ký, biên bản, bài làm PDF). Không bắt buộc trước khi import môn khác.
      </p>

      {preview && (
        <div className="report-preview" style={{ marginBottom: '1rem' }}>
          <p>
            Tổng HS: <strong>{preview.totalStudents}</strong> · Đã nộp: <strong>{preview.submitted}</strong> · Đang thi:{' '}
            <strong>{preview.inExam}</strong> · Vi phạm: <strong>{preview.violations}</strong>
          </p>
          <table className="cbt-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Môn</th>
                <th>Đã nộp</th>
                <th>Đang mở</th>
                <th>Đã khóa</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview.bySubject).map(([code, s]) => (
                <tr key={code}>
                  <td>{TN_THPT_SUBJECTS.find((x) => x.code === code)?.nameVi ?? code}</td>
                  <td>{s.submitted}</td>
                  <td>{s.open}</td>
                  <td>{s.locked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        className="cbt-btn cbt-btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const date = new Date();
            const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            const hm = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
            await downloadProctorFile(
              `/proctor/sessions/${examSessionId}/room-archive`,
              token,
              `room-archive-${examSessionId.slice(0, 8)}-${ymd}-${hm}.zip`,
            );
            showToast('info', 'Đã xuất gói phòng thi.');
          } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Xuất gói phòng thi thất bại');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Đang xuất…' : 'Xuất gói phòng thi (ZIP)'}
      </button>
      <button type="button" className="cbt-btn cbt-btn-outline" onClick={downloadReport} disabled={busy} style={{ marginLeft: '0.5rem' }}>
        {busy ? 'Đang xuất…' : 'Tải báo cáo (Excel + CSV)'}
      </button>
      <button
        type="button"
        className="cbt-btn cbt-btn-outline"
        style={{ marginLeft: '0.5rem' }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const data = await proctorApi<{
              excelBase64: string;
              filename: string;
              note: string;
            }>(`/proctor/sessions/${examSessionId}/report/so-export`, token);
            const bytes = Uint8Array.from(atob(data.excelBase64), (c) => c.charCodeAt(0));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(
              new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              }),
            );
            a.download = data.filename;
            a.click();
            showToast('info', data.note);
          } catch (e) {
            showToast('error', e instanceof Error ? e.message : 'Xuất Sở thất bại');
          } finally {
            setBusy(false);
          }
        }}
      >
        Xuất báo cáo Sở
      </button>
      <p className="admin-hint" style={{ marginTop: '0.75rem' }}>
        Báo cáo Sở: file Excel tổng hợp — đối chiếu mẫu CV Sở GDĐT Cà Mau trước khi nộp.
      </p>
    </div>
  );
}
