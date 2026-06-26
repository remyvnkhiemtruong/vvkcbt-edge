import { useState } from 'react';
import { vi } from '@shared/index';

const API = import.meta.env.VITE_API_URL || '';

export interface GridItemExtended {
  id: string;
  sbd: string;
  examAccount?: string;
  status: string;
  violations: number;
  locked: boolean;
  submitted: boolean;
  answeredCount?: number;
  questionCount?: number;
  fullName?: string;
  className?: string;
  labRoom?: string;
  subjectCode?: string;
  subjectNameVi?: string;
  slotId?: string;
  slotStatus?: string;
  scoreTotal?: number;
  partScores?: { part1?: number; part2?: number; part3?: number };
  pendingManual?: boolean;
  submittedAt?: string;
  manualOverride?: boolean;
}

export function ScoreEditor({
  item,
  token,
  onSaved,
}: {
  item: GridItemExtended;
  token: string;
  onSaved: (scoreTotal?: number, partScores?: GridItemExtended['partScores']) => void;
}) {
  const [part1, setPart1] = useState(String(item.partScores?.part1 ?? ''));
  const [part2, setPart2] = useState(String(item.partScores?.part2 ?? ''));
  const [part3, setPart3] = useState(String(item.partScores?.part3 ?? ''));
  const [total, setTotal] = useState(String(item.scoreTotal ?? ''));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const hasParts =
    item.partScores != null &&
    (item.partScores.part1 != null ||
      item.partScores.part2 != null ||
      item.partScores.part3 != null);

  const save = async () => {
    if (!item.slotId) {
      setErr('Không có slot môn — chỉ sửa sau khi nộp bài');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const body: Record<string, unknown> = { reviewedBy: 'proctor', reason };
      if (hasParts) {
        if (part1 !== '') body.part1 = Number(part1);
        if (part2 !== '') body.part2 = Number(part2);
        if (part3 !== '') body.part3 = Number(part3);
      } else if (total !== '') {
        body.total = Number(total);
      }
      const res = await fetch(`${API}/api/proctor/slots/${item.slotId}/score`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const sr = data.scoreResult as { total?: number; partScores?: GridItemExtended['partScores'] };
      onSaved(sr.total, sr.partScores);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu điểm thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <h4 style={{ margin: '0 0 0.5rem' }}>Sửa điểm (sau nộp bài)</h4>
      {hasParts ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label>
            {vi.proctor.partLabel(1)}
            <input className="cbt-input" type="number" step="0.01" value={part1} onChange={(e) => setPart1(e.target.value)} style={{ width: 72 }} />
          </label>
          <label>
            {vi.proctor.partLabel(2)}
            <input className="cbt-input" type="number" step="0.01" value={part2} onChange={(e) => setPart2(e.target.value)} style={{ width: 72 }} />
          </label>
          <label>
            {vi.proctor.partLabel(3)}
            <input className="cbt-input" type="number" step="0.01" value={part3} onChange={(e) => setPart3(e.target.value)} style={{ width: 72 }} />
          </label>
        </div>
      ) : (
        <label>
          Tổng điểm
          <input className="cbt-input" type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} style={{ width: 100 }} />
        </label>
      )}
      <input
        className="cbt-input"
        placeholder="Lý do sửa (tùy chọn)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ marginTop: '0.5rem', width: '100%' }}
      />
      {err && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{err}</p>}
      <button type="button" className="cbt-btn cbt-btn-primary" style={{ marginTop: '0.5rem' }} disabled={busy || !item.submitted} onClick={save}>
        {busy ? 'Đang lưu…' : 'Lưu điểm'}
      </button>
    </div>
  );
}

export function StudentDetailPanel({
  item,
  token,
  onClose,
  onScoreSaved,
}: {
  item: GridItemExtended;
  token: string;
  onClose: () => void;
  onScoreSaved: (id: string, scoreTotal?: number, partScores?: GridItemExtended['partScores']) => void;
}) {
  const pct =
    item.questionCount && item.questionCount > 0 && item.answeredCount != null
      ? Math.round((item.answeredCount / item.questionCount) * 100)
      : null;

  return (
    <div className="proctor-action-panel">
      <h3>
        SBD {item.sbd} {item.violations > 0 && <span style={{ color: '#f87171' }}>VP {item.violations}</span>}
      </h3>
      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
        <strong>{item.fullName || '—'}</strong> · Lớp {item.className || '—'} · {item.labRoom || '—'}
      </p>
      <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', opacity: 0.9 }}>
        Môn: {item.subjectNameVi || item.subjectCode || '—'} · Trạng thái: {item.status}
        {pct != null ? ` · ${pct}% câu` : ''}
        {item.submittedAt ? ` · Nộp ${new Date(item.submittedAt).toLocaleString('vi-VN')}` : ''}
      </p>
      {item.submitted && (
        <p style={{ margin: '0.5rem 0', fontSize: '1rem' }}>
          Điểm:{' '}
          <strong>
            {item.scoreTotal != null ? item.scoreTotal : '—'}
            {item.manualOverride ? ' (đã sửa GT)' : ''}
          </strong>
          {item.partScores && (
            <span style={{ fontSize: '0.85rem', marginLeft: 8 }}>
              {vi.proctor.partLabel(1)} {item.partScores.part1 ?? '—'} · {vi.proctor.partLabel(2)}{' '}
              {item.partScores.part2 ?? '—'} · {vi.proctor.partLabel(3)} {item.partScores.part3 ?? '—'}
            </span>
          )}
          {item.pendingManual && <span style={{ color: '#fbbf24' }}> · Chờ chấm Văn</span>}
        </p>
      )}
      {item.submitted && (
        <ScoreEditor
          item={item}
          token={token}
          onSaved={(scoreTotal, partScores) => onScoreSaved(item.id, scoreTotal, partScores)}
        />
      )}
      <div className="proctor-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
