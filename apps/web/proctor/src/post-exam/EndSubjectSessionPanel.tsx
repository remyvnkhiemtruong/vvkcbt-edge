import { useState } from 'react';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { proctorFetch } from '../api';
import type { SubjectRoomCompleteData } from './ScoreboardOverlay';

export function EndSubjectSessionPanel({
  token,
  examSessionId,
  defaultRoom,
  onComplete,
}: {
  token: string;
  examSessionId: string;
  defaultRoom: string;
  onComplete?: (data: SubjectRoomCompleteData) => void;
}) {
  const [subjectCode, setSubjectCode] = useState('MATH');
  const [room, setRoom] = useState(defaultRoom);
  const [preview, setPreview] = useState<SubjectRoomCompleteData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const loadPreview = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorFetch(
        `/proctor/sessions/${examSessionId}/room-score-sheet/preview?subjectCode=${encodeURIComponent(subjectCode)}&room=${encodeURIComponent(room)}`,
        token,
      );
      const data = await res.json();
      const subjectNameVi = TN_THPT_SUBJECTS.find((s) => s.code === subjectCode)?.nameVi ?? subjectCode;
      setPreview({
        examSessionId,
        subjectCode,
        subjectNameVi,
        room,
        stats: data.stats,
        rows: data.rows ?? [],
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không tải được trạng thái ca');
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!window.confirm('Kết thúc ca môn này? Thí sinh chưa nộp sẽ không được tính vào biên bản tự động.')) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorFetch(`/proctor/sessions/${examSessionId}/end-subject-room`, token, {
        method: 'POST',
        body: JSON.stringify({ subjectCode, room }),
      });
      const data = await res.json();
      const subjectNameVi = TN_THPT_SUBJECTS.find((s) => s.code === subjectCode)?.nameVi ?? subjectCode;
      const payload: SubjectRoomCompleteData = {
        examSessionId,
        subjectCode,
        subjectNameVi,
        room,
        stats: data.stats,
        rows: data.rows ?? [],
        forced: true,
      };
      setPreview(payload);
      onComplete?.(payload);
      setMsg('Đã kết thúc ca môn — bảng điểm sẵn sàng.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kết thúc ca thất bại');
    } finally {
      setBusy(false);
    }
  };

  const pending = preview ? preview.stats.total - preview.stats.completed : null;

  return (
    <div className="proctor-tab-panel end-subject-panel">
      <h3>Kết thúc ca môn</h3>
      <p className="admin-hint">Xem trạng thái nộp bài và kết thúc ca khi giám thị xác nhận (kể cả còn HS chưa nộp).</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <label>
          Môn
          <select className="cbt-input" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>
            {TN_THPT_SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>{s.nameVi}</option>
            ))}
          </select>
        </label>
        <label>
          Phòng
          <input className="cbt-input" value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={loadPreview} disabled={busy}>
          Kiểm tra tiến độ
        </button>
        <button type="button" className="cbt-btn cbt-btn-primary" onClick={endSession} disabled={busy}>
          Kết thúc ca môn
        </button>
      </div>
      {msg && <p className="admin-hint">{msg}</p>}
      {preview && (
        <div className="end-subject-checklist">
          <p>
            <strong>{preview.subjectNameVi}</strong> · Đã nộp {preview.stats.completed}/{preview.stats.total}
          </p>
          {pending != null && pending > 0 && (
            <ul className="admin-hint">
              <li>Còn {pending} thí sinh chưa nộp — cần xác nhận trước khi in biên bản</li>
              <li>Kiểm tra tab Chấm bài nếu có câu Văn chờ chấm</li>
              <li>Tải PDF/Excel từ overlay bảng điểm sau khi kết thúc</li>
            </ul>
          )}
          {preview.rows.length > 0 && (
            <table className="cbt-table" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
              <thead>
                <tr>
                  <th>STT</th><th>SBD</th><th>Họ tên</th><th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r) => (
                  <tr key={r.sbd}>
                    <td>{r.stt}</td><td>{r.sbd}</td><td>{r.fullName}</td><td>{r.pendingManual ? 'Chờ chấm' : r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
