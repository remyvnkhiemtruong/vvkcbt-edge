import { vi } from '@shared/index';

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
  submittedAt?: string;
  manualOverride?: boolean;
}

export function StudentDetailPanel({
  item,
  onClose,
}: {
  item: GridItemExtended;
  onClose: () => void;
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
          <strong>{item.scoreTotal != null ? item.scoreTotal : '—'}</strong>
          {item.partScores && (
            <span style={{ fontSize: '0.85rem', marginLeft: 8 }}>
              {vi.proctor.partLabel(1)} {item.partScores.part1 ?? '—'} · {vi.proctor.partLabel(2)}{' '}
              {item.partScores.part2 ?? '—'} · {vi.proctor.partLabel(3)} {item.partScores.part3 ?? '—'}
            </span>
          )}
        </p>
      )}
      <div className="proctor-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
