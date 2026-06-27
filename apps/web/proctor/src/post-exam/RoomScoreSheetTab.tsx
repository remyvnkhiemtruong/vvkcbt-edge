import { useEffect, useState } from 'react';
import { SubjectCodeSelect } from './SubjectCodeSelect';

const API = import.meta.env.VITE_API_URL || '';
const NAMES_KEY = 'vnu_proctor_roomsheet_names';

function loadNames(): { proctor1Name: string; proctor2Name: string } {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { proctor1Name: '', proctor2Name: '' };
}

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
  const [proctor1Name, setProctor1Name] = useState('');
  const [proctor2Name, setProctor2Name] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const hasSubject = subjectCode.trim().length > 0;
  const roomOptions = labRooms.length > 0 ? labRooms : defaultRoom ? [defaultRoom] : [];

  useEffect(() => {
    const s = loadNames();
    setProctor1Name(s.proctor1Name);
    setProctor2Name(s.proctor2Name);
  }, []);

  useEffect(() => {
    localStorage.setItem(NAMES_KEY, JSON.stringify({ proctor1Name, proctor2Name }));
  }, [proctor1Name, proctor2Name]);

  useEffect(() => {
    if (roomOptions.length === 1 && roomOptions[0] && room !== roomOptions[0]) {
      setRoom(roomOptions[0]);
    }
  }, [roomOptions.join('|')]);

  const download = async (format: 'pdf' | 'xlsx') => {
    if (!hasSubject) {
      setMsg('Chọn môn thi trước khi tải biên bản.');
      return;
    }
    if (!room.trim()) {
      setMsg('Nhập phòng thi trước khi tải biên bản.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const params = new URLSearchParams({
        subjectCode: subjectCode.trim(),
        room: room.trim(),
        format,
        proctor1Name,
        proctor2Name,
      });
      const res = await fetch(
        `${API}/api/proctor/sessions/${examSessionId}/room-score-sheet?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bien-ban-${subjectCode.trim()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      setMsg(format === 'pdf' ? 'Đã tải PDF biên bản phòng thi.' : 'Đã tải Excel biên bản phòng thi.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Xuất biên bản thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="proctor-tab-panel">
      <h3>Biên bản điểm phòng thi</h3>
      <SubjectCodeSelect
        subjectCodes={subjectCodes}
        value={subjectCode}
        onChange={(code) => onSubjectCodeChange?.(code)}
      />
      {!hasSubject && (
        <p className="cbt-error-text" style={{ fontSize: '0.85rem' }}>
          Chọn môn thi để tải biên bản.
        </p>
      )}
      <p className="admin-hint">
        In 2 bản, thí sinh ký xác nhận điểm; giám thị ký tay trên bản in.
      </p>
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
        <label>
          Giám thị 1
          <input className="cbt-input" value={proctor1Name} onChange={(e) => setProctor1Name(e.target.value)} />
        </label>
        <label>
          Giám thị 2
          <input className="cbt-input" value={proctor2Name} onChange={(e) => setProctor2Name(e.target.value)} />
        </label>
      </div>
      <div className="proctor-form-actions">
        <button
          type="button"
          className="cbt-btn cbt-btn-primary"
          disabled={busy || !hasSubject}
          onClick={() => download('pdf')}
        >
          {busy ? 'Đang xuất…' : 'Tải PDF biên bản'}
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
