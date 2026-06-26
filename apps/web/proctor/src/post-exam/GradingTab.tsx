import { useEffect, useState } from 'react';
import { CbtDataTable } from '@shared/index';
import type { CbtColumn } from '@shared/index';
import { proctorApi } from '../api';

interface FlagRow {
  id: string;
  questionId: string;
  questionStem?: string;
  standardAnswer?: string;
  studentAnswer: string;
  maxScore?: number;
}

export function GradingTab({ token, examSessionId }: { token: string; examSessionId: string }) {
  const [rows, setRows] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [essayModal, setEssayModal] = useState<FlagRow | null>(null);
  const [reading, setReading] = useState(0);
  const [writing, setWriting] = useState(0);

  const reload = () => {
    setLoading(true);
    proctorApi<FlagRow[]>(`/post-exam/grading/pending?examSessionId=${examSessionId}`, token)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [examSessionId, token]);

  const review = async (
    flagId: string,
    score: number,
    rubricScores?: Array<{ partKey: string; score: number; maxScore: number }>,
  ) => {
    await proctorApi(`/post-exam/grading/${flagId}/review`, token, {
      method: 'POST',
      body: JSON.stringify({ reviewedScore: score, reviewedBy: 'proctor', rubricScores }),
    });
    reload();
  };

  const reviewEssay = async (flagId: string, readScore: number, writeScore: number) => {
    const rubricScores = [
      { partKey: 'doc_hieu', score: readScore, maxScore: 3 },
      { partKey: 'lam_van', score: writeScore, maxScore: 7 },
    ];
    await review(flagId, readScore + writeScore, rubricScores);
    setEssayModal(null);
  };

  const columns: CbtColumn<FlagRow>[] = [
    { key: 'q', header: 'Câu hỏi', render: (r) => r.questionStem || r.questionId },
    { key: 'std', header: 'Đ/A chuẩn', align: 'center', render: (r) => <strong>{r.standardAnswer}</strong> },
    {
      key: 'stu',
      header: 'Thí sinh nhập',
      align: 'center',
      render: (r) => <strong style={{ color: 'var(--cbt-danger)' }}>{r.studentAnswer}</strong>,
    },
    {
      key: 'act',
      header: 'Hành động',
      render: (r) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button type="button" className="cbt-btn cbt-btn-success" style={{ fontSize: '0.75rem' }} onClick={() => review(r.id, r.maxScore ?? 0.25)}>
            Chấp nhận
          </button>
          <button type="button" className="cbt-btn cbt-btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => review(r.id, 0)}>
            Từ chối
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn-outline"
            style={{ fontSize: '0.75rem' }}
            onClick={() => {
              setEssayModal(r);
              setReading(0);
              setWriting(0);
            }}
          >
            Chấm Văn 2 phần
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="proctor-tab-panel">
      <h3>Chấm bài thủ công</h3>
      {loading ? <p>Đang tải…</p> : <CbtDataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}

      {essayModal && (
        <div className="grading-modal" role="dialog" aria-modal="true">
          <div className="grading-modal__backdrop" onClick={() => setEssayModal(null)} />
          <div className="grading-modal__panel">
            <h4>Chấm tự luận Văn</h4>
            <p className="admin-hint">{essayModal.questionStem || essayModal.questionId}</p>
            <p><strong>Bài làm:</strong> {essayModal.studentAnswer}</p>
            <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0' }}>
              <label>
                Đọc hiểu (0–3)
                <input type="number" className="cbt-input" step="0.25" min={0} max={3} value={reading} onChange={(e) => setReading(Number(e.target.value))} />
              </label>
              <label>
                Làm văn (0–7)
                <input type="number" className="cbt-input" step="0.25" min={0} max={7} value={writing} onChange={(e) => setWriting(Number(e.target.value))} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="cbt-btn cbt-btn-primary" onClick={() => reviewEssay(essayModal.id, reading, writing)}>
                Lưu điểm
              </button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setEssayModal(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .grading-modal { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center; }
        .grading-modal__backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
        .grading-modal__panel { position: relative; background: #1e293b; color: #f8fafc; padding: 1.25rem; border-radius: 8px; width: min(480px, 92vw); }
        .grading-modal__panel label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
