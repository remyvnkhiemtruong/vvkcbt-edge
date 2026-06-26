import { useState } from 'react';
import { getSubjectNameVi } from '@shared/index';
import { proctorFetch } from '../api';
import type { SubjectRoomCompleteData } from './ScoreboardOverlay';
import { SubjectCodeSelect } from './SubjectCodeSelect';

export function EndSubjectSessionPanel({
  token,
  examSessionId,
  subjectCodes,
  subjectCode,
  onSubjectCodeChange,
  defaultRoom,
  onComplete,
}: {
  token: string;
  examSessionId: string;
  subjectCodes: string[];
  subjectCode: string;
  onSubjectCodeChange?: (code: string) => void;
  defaultRoom: string;
  onComplete?: (data: SubjectRoomCompleteData) => void;
}) {
  const [room, setRoom] = useState(defaultRoom);
  const [preview, setPreview] = useState<SubjectRoomCompleteData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const subjectNameVi = getSubjectNameVi(subjectCode);

  const loadPreview = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorFetch(
        `/proctor/sessions/${examSessionId}/room-score-sheet/preview?subjectCode=${encodeURIComponent(subjectCode)}&room=${encodeURIComponent(room)}`,
        token,
      );
      const data = await res.json();
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
    if (!window.confirm('Kết thúc ca thi? Thí sinh chưa nộp sẽ không được tính vào biên bản tự động.')) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await proctorFetch(`/proctor/sessions/${examSessionId}/end-subject-room`, token, {
        method: 'POST',
        body: JSON.stringify({ subjectCode, room }),
      });
      const data = await res.json();
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
      setMsg('Đã kết thúc ca thi — bảng điểm sẵn sàng.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kết thúc ca thất bại');
    } finally {
      setBusy(false);
    }
  };

  const pending = preview ? preview.stats.total - preview.stats.completed : null;

  return (
    <div className="proctor-tab-panel end-subject-panel">
      <h3>Kết thúc ca thi</h3>
      <SubjectCodeSelect
        subjectCodes={subjectCodes}
        value={subjectCode}
        onChange={(code) => onSubjectCodeChange?.(code)}
      />
      <p className="admin-hint">
        Xem tiến độ nộp bài và kết thúc ca theo từng môn (các môn cùng khung giờ trong một ca).
      </p>
      <div className="proctor-form-row">
        <label>
          Phòng
          <input className="cbt-input" value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={loadPreview} disabled={busy}>
          Kiểm tra tiến độ
        </button>
        <button type="button" className="cbt-btn cbt-btn-primary" onClick={endSession} disabled={busy}>
          Kết thúc ca thi
        </button>
      </div>
      {msg && <p className="admin-hint">{msg}</p>}
      {preview && (
        <div className="end-subject-checklist">
          <p>
            Đã nộp <strong>{preview.stats.completed}</strong> / {preview.stats.total} thí sinh
          </p>
          {pending != null && pending > 0 && (
            <ul className="admin-hint">
              <li>Còn {pending} thí sinh chưa nộp — cần xác nhận trước khi in biên bản</li>
              <li>Tải PDF/Excel từ overlay bảng điểm sau khi kết thúc</li>
            </ul>
          )}
          {preview.rows.length > 0 && (
            <div className="proctor-table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="cbt-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>SBD</th>
                    <th>Họ tên</th>
                    <th>Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((r) => (
                    <tr key={r.sbd}>
                      <td>{r.stt}</td>
                      <td>{r.sbd}</td>
                      <td>{r.fullName}</td>
                      <td>{r.total ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
