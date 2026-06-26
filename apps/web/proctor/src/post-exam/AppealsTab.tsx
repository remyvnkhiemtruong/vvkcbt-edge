import { useEffect, useState } from 'react';
import { getSubjectNameVi } from '@shared/index';
import { proctorApi } from '../api';

interface AppealRow {
  id: string;
  sbd: string;
  subjectCode: string;
  questionId: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export function AppealsTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const [form, setForm] = useState({ sbd: '', subjectCode: 'MATH', reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    proctorApi<AppealRow[]>(`/proctor/sessions/${examSessionId}/appeals`, token)
      .then(setRows)
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, [examSessionId, token]);

  const create = async () => {
    setBusy(true);
    setMsg('');
    try {
      await proctorApi(`/proctor/sessions/${examSessionId}/appeals`, token, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ sbd: '', subjectCode: form.subjectCode, reason: '' });
      load();
      setMsg('Đã tạo đơn phúc khảo.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: string, status: 'accepted' | 'rejected') => {
    setBusy(true);
    try {
      await proctorApi(`/proctor/appeals/${id}/review`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewedBy: 'proctor' }),
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proctor-tab-panel">
      <h3>Phúc khảo (TT24/2024)</h3>
      <p className="admin-hint">Tạo và xử lý đơn phúc khảo theo Phụ lục IV TT24.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          className="cbt-input"
          placeholder="SBD"
          value={form.sbd}
          onChange={(e) => setForm((f) => ({ ...f, sbd: e.target.value }))}
        />
        <input
          className="cbt-input"
          placeholder="Môn (MATH, ENGLISH…)"
          value={form.subjectCode}
          onChange={(e) => setForm((f) => ({ ...f, subjectCode: e.target.value }))}
        />
        <input
          className="cbt-input"
          style={{ minWidth: 200 }}
          placeholder="Lý do"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
        />
        <button type="button" className="cbt-btn cbt-btn-primary" disabled={busy} onClick={create}>
          Tạo đơn
        </button>
      </div>
      {msg && <p className="admin-hint">{msg}</p>}
      <table className="cbt-table" style={{ fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th>SBD</th>
            <th>Môn</th>
            <th>Lý do</th>
            <th>TT</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.sbd}</td>
              <td>{getSubjectNameVi(r.subjectCode)}</td>
              <td>{r.reason}</td>
              <td>{r.status}</td>
              <td>
                {r.status === 'pending' && (
                  <>
                    <button type="button" className="cbt-btn cbt-btn-outline" disabled={busy} onClick={() => review(r.id, 'accepted')}>
                      Chấp nhận
                    </button>{' '}
                    <button type="button" className="cbt-btn cbt-btn-outline" disabled={busy} onClick={() => review(r.id, 'rejected')}>
                      Từ chối
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
