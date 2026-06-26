import { useState } from 'react';
import { proctorApi } from '../api';

export function ReportTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 6000);
  };

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
      <p className="admin-hint">Tải file Excel kết quả và CSV nhật ký cho ca thi hiện tại.</p>
      <button type="button" className="cbt-btn cbt-btn-primary" onClick={downloadReport} disabled={busy}>
        {busy ? 'Đang xuất…' : 'Tải báo cáo (Excel + CSV)'}
      </button>
    </div>
  );
}
