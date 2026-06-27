import { useEffect, useState } from 'react';
import { proctorFetch } from '../api';
import { SubjectCodeSelect } from './SubjectCodeSelect';

export function RoomScoreSheetTab({
  token,
  examSessionId,
  subjectCodes,
  subjectCode,
  onSubjectCodeChange,
  defaultRoom,
  labRooms = [],
}: {
  token: string;
  examSessionId: string;
  subjectCodes: string[];
  subjectCode: string;
  onSubjectCodeChange?: (code: string) => void;
  defaultRoom: string;
  labRooms?: string[];
}) {
  const [room, setRoom] = useState(defaultRoom);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const hasSubject = subjectCode.trim().length > 0;
  const roomOptions = labRooms.length > 0 ? labRooms : defaultRoom ? [defaultRoom] : [];

  useEffect(() => {
    if (roomOptions.length === 1 && roomOptions[0] && room !== roomOptions[0]) {
      setRoom(roomOptions[0]);
    }
  }, [roomOptions.join('|')]);

  const download = async (format: 'pdf' | 'xlsx') => {
    if (!hasSubject) {
      setMsg('Chọn môn thi trước khi tải danh sách.');
      return;
    }
    if (!room.trim()) {
      setMsg('Nhập phòng thi trước khi tải danh sách.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const params = new URLSearchParams({
        subjectCode: subjectCode.trim(),
        room: room.trim(),
        format,
      });
      const res = await proctorFetch(
        `/proctor/sessions/${examSessionId}/room-score-sheet?${params}`,
        token,
      );
      const pdfFallback = res.headers.get('X-Pdf-Fallback') === 'excel';
      const actualFormat = pdfFallback ? 'xlsx' : format;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const date = new Date();
      const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      a.download = `DanhSachDiem_${subjectCode.trim()}_${room.trim().replace(/\s+/g, '_')}_${ymd}.${actualFormat === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      setMsg(
        pdfFallback
          ? 'PDF không khả dụng — đã tải Excel thay thế.'
          : format === 'pdf'
            ? 'Đã tải PDF danh sách điểm.'
            : 'Đã tải Excel danh sách điểm.',
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Xuất danh sách thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proctor-tab-panel">
      <h3>Danh sách điểm phòng thi</h3>
      <SubjectCodeSelect
        subjectCodes={subjectCodes}
        value={subjectCode}
        onChange={(code) => onSubjectCodeChange?.(code)}
      />
      {!hasSubject && (
        <p className="cbt-error-text" style={{ fontSize: '0.85rem' }}>
          Chọn môn thi để tải danh sách điểm.
        </p>
      )}
      <div className="proctor-form-row">
        <label>
          Phòng
          {roomOptions.length > 1 ? (
            <select className="cbt-input" value={room} onChange={(e) => setRoom(e.target.value)}>
              {roomOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <input className="cbt-input" value={room} onChange={(e) => setRoom(e.target.value)} />
          )}
        </label>
      </div>
      <div className="proctor-form-actions">
        <button
          type="button"
          className="cbt-btn cbt-btn-primary"
          disabled={busy || !hasSubject}
          onClick={() => download('pdf')}
        >
          {busy ? 'Đang xuất…' : 'Tải PDF'}
        </button>
        <button
          type="button"
          className="cbt-btn cbt-btn-outline"
          disabled={busy || !hasSubject}
          onClick={() => download('xlsx')}
        >
          Tải Excel
        </button>
      </div>
      {msg && <p className="proctor-tab-msg">{msg}</p>}
    </div>
  );
}
