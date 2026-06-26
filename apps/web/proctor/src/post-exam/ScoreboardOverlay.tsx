import { useState } from 'react';
import { proctorFetch } from '../api';

export interface ScoreboardRow {
  stt: number;
  sbd: string;
  fullName: string;
  className: string;
  part1: string | number;
  part2: string | number;
  part3: string | number;
  total: string | number;
  note?: string;
  pendingManual?: boolean;
}

export interface SubjectRoomCompleteData {
  examSessionId: string;
  subjectCode: string;
  subjectNameVi: string;
  room: string;
  stats: { total: number; completed: number; isComplete: boolean };
  rows: ScoreboardRow[];
  forced?: boolean;
}

const SIG_KEY = 'vnu_proctor_signatures';

function loadSigs() {
  try {
    const raw = localStorage.getItem(SIG_KEY);
    if (raw) return JSON.parse(raw) as { proctor1Name?: string; proctor2Name?: string; signature1?: string; signature2?: string };
  } catch {
    /* ignore */
  }
  return {};
}

export function ScoreboardOverlay({
  data,
  token,
  onClose,
}: {
  data: SubjectRoomCompleteData;
  token: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [msg, setMsg] = useState('');

  const download = async (format: 'pdf' | 'xlsx') => {
    setBusy(format);
    setMsg('');
    try {
      const sigs = loadSigs();
      const params = new URLSearchParams({
        subjectCode: data.subjectCode,
        room: data.room,
        format,
        proctor1Name: sigs.proctor1Name ?? '',
        proctor2Name: sigs.proctor2Name ?? '',
      });
      if (sigs.signature1) params.set('signature1', sigs.signature1);
      if (sigs.signature2) params.set('signature2', sigs.signature2);
      const res = await proctorFetch(
        `/proctor/sessions/${data.examSessionId}/room-score-sheet?${params}`,
        token,
      );
      if (!res.ok) throw new Error(await res.text());
      const pdfFallback = res.headers.get('X-Pdf-Fallback') === 'excel';
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const date = new Date();
      const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      a.download = `BienBanDiem_${data.subjectCode}_${data.room.replace(/\s+/g, '_')}_${ymd}.${pdfFallback || format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      a.click();
      setMsg(
        pdfFallback
          ? 'PDF không khả dụng — đã tải Excel biên bản thay thế.'
          : format === 'pdf'
            ? 'Đã tải PDF biên bản.'
            : 'Đã tải Excel biên bản.',
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Tải biên bản thất bại');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="scoreboard-overlay" role="dialog" aria-modal="true" aria-labelledby="scoreboard-title">
      <div className="scoreboard-overlay__backdrop" onClick={onClose} />
      <div className="scoreboard-overlay__panel">
        <header className="scoreboard-overlay__header">
          <div>
            <h2 id="scoreboard-title">Bảng điểm phòng thi</h2>
            <p className="admin-hint">
              {data.subjectNameVi} · {data.room}
              {data.forced ? ' · Kết thúc ca (giám thị xác nhận)' : ''}
            </p>
            <p className="admin-hint">
              Đã nộp: <strong>{data.stats.completed}</strong> / {data.stats.total}
            </p>
          </div>
          <div className="scoreboard-overlay__actions">
            <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => download('pdf')} disabled={!!busy}>
              {busy === 'pdf' ? 'Đang tải…' : 'Tải PDF'}
            </button>
            <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => download('xlsx')} disabled={!!busy}>
              {busy === 'xlsx' ? 'Đang tải…' : 'Tải Excel'}
            </button>
            <button type="button" className="cbt-btn cbt-btn-primary" onClick={onClose}>
              Đóng
            </button>
          </div>
        </header>
        {msg && <p className="admin-hint" style={{ padding: '0 1rem' }}>{msg}</p>}
        <div className="scoreboard-overlay__table-wrap">
          <table className="cbt-table scoreboard-overlay__table">
            <thead>
              <tr>
                <th>STT</th>
                <th>SBD</th>
                <th>Họ tên</th>
                <th>Lớp</th>
                <th>P.I</th>
                <th>P.II</th>
                <th>P.III</th>
                <th>Tổng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.sbd || r.stt}>
                  <td>{r.stt}</td>
                  <td>{r.sbd}</td>
                  <td>{r.fullName}</td>
                  <td>{r.className}</td>
                  <td>{r.part1}</td>
                  <td>{r.part2}</td>
                  <td>{r.part3}</td>
                  <td>
                    {r.pendingManual ? (
                      <span className="scoreboard-badge scoreboard-badge--pending">Chờ chấm</span>
                    ) : (
                      r.total
                    )}
                  </td>
                  <td>{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        .scoreboard-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
        .scoreboard-overlay__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.65); }
        .scoreboard-overlay__panel {
          position: relative; background: #0f172a; color: #f8fafc; width: min(96vw, 1100px); max-height: 90vh;
          border-radius: 10px; border: 1px solid #334155; display: flex; flex-direction: column; overflow: hidden;
        }
        .scoreboard-overlay__header { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid #334155; flex-wrap: wrap; }
        .scoreboard-overlay__header h2 { margin: 0 0 0.25rem; font-size: 1.25rem; }
        .scoreboard-overlay__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-start; }
        .scoreboard-overlay__table-wrap { overflow: auto; padding: 0 1rem 1rem; flex: 1; }
        .scoreboard-overlay__table { font-size: 0.85rem; }
        .scoreboard-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
        .scoreboard-badge--pending { background: #fef3c7; color: #92400e; }
      `}</style>
    </div>
  );
}

export function readAutoScoreboardEnabled(): boolean {
  const env = import.meta.env.VITE_AUTO_SCOREBOARD;
  if (env === 'false') return false;
  const stored = localStorage.getItem('vnu_auto_scoreboard');
  if (stored === 'false') return false;
  return true;
}
