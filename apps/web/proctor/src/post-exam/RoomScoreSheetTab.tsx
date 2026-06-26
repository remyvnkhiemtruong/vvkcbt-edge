import { useEffect, useState } from 'react';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { SignaturePad } from './SignaturePad';

const API = import.meta.env.VITE_API_URL || '';
const SIG_KEY = 'vnu_proctor_signatures';

interface SavedSigs {
  proctor1Name: string;
  proctor2Name: string;
  signature1?: string;
  signature2?: string;
}

function loadSigs(): SavedSigs {
  try {
    const raw = localStorage.getItem(SIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { proctor1Name: '', proctor2Name: '' };
}

export function RoomScoreSheetTab({
  token,
  examSessionId,
  defaultRoom,
}: {
  token: string;
  examSessionId: string;
  defaultRoom: string;
}) {
  const [subjectCode, setSubjectCode] = useState('MATH');
  const [room, setRoom] = useState(defaultRoom);
  const [proctor1Name, setProctor1Name] = useState('');
  const [proctor2Name, setProctor2Name] = useState('');
  const [signature1, setSignature1] = useState<string | undefined>();
  const [signature2, setSignature2] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const s = loadSigs();
    setProctor1Name(s.proctor1Name);
    setProctor2Name(s.proctor2Name);
    setSignature1(s.signature1);
    setSignature2(s.signature2);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SIG_KEY,
      JSON.stringify({ proctor1Name, proctor2Name, signature1, signature2 }),
    );
  }, [proctor1Name, proctor2Name, signature1, signature2]);

  const download = async (format: 'pdf' | 'xlsx') => {
    setBusy(true);
    setMsg('');
    try {
      const params = new URLSearchParams({
        subjectCode,
        room,
        format,
        proctor1Name,
        proctor2Name,
      });
      if (signature1) params.set('signature1', signature1);
      if (signature2) params.set('signature2', signature2);
      const res = await fetch(
        `${API}/api/proctor/sessions/${examSessionId}/room-score-sheet?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bien-ban-${subjectCode}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
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
      <p className="admin-hint">
        In 2 bản — thí sinh ký xác nhận điểm; giám thị ký tay trên bản in hoặc ký số trên tablet rồi xuất PDF.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <label>
          Môn
          <select className="cbt-input" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>
            {TN_THPT_SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.nameVi}
              </option>
            ))}
          </select>
        </label>
        <label>
          Phòng
          <input className="cbt-input" value={room} onChange={(e) => setRoom(e.target.value)} />
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <SignaturePad label="Chữ ký GT 1 (tùy chọn)" value={signature1} onChange={setSignature1} />
        <SignaturePad label="Chữ ký GT 2 (tùy chọn)" value={signature2} onChange={setSignature2} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="cbt-btn cbt-btn-primary" disabled={busy} onClick={() => download('pdf')}>
          {busy ? 'Đang xuất…' : 'Tải PDF biên bản'}
        </button>
        <button type="button" className="cbt-btn cbt-btn-outline" disabled={busy} onClick={() => download('xlsx')}>
          Tải Excel
        </button>
      </div>
      {msg && <p style={{ marginTop: '0.75rem', color: '#93c5fd' }}>{msg}</p>}
    </div>
  );
}
