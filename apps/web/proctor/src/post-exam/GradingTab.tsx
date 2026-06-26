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

  const reviewEssay = async (flagId: string, reading: number, writing: number) => {
    const rubricScores = [
      { partKey: 'doc_hieu', score: reading, maxScore: 3 },
      { partKey: 'lam_van', score: writing, maxScore: 7 },
    ];
    await review(flagId, reading + writing, rubricScores);
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
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" className="cbt-btn cbt-btn-success" style={{ fontSize: '0.75rem' }} onClick={() => review(r.id, r.maxScore ?? 0.25)}>
              Chấp nhận
            </button>
            <button type="button" className="cbt-btn cbt-btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => review(r.id, 0)}>
              Từ chối
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem' }}>Văn:</span>
            <input type="number" step="0.25" min={0} max={3} placeholder="Đọc hiểu" id={`read-${r.id}`} className="cbt-input" style={{ width: 70 }} />
            <input type="number" step="0.25" min={0} max={7} placeholder="Làm văn" id={`write-${r.id}`} className="cbt-input" style={{ width: 70 }} />
            <button
              type="button"
              className="cbt-btn cbt-btn-outline"
              style={{ fontSize: '0.75rem' }}
              onClick={() => {
                const reading = Number((document.getElementById(`read-${r.id}`) as HTMLInputElement)?.value || 0);
                const writing = Number((document.getElementById(`write-${r.id}`) as HTMLInputElement)?.value || 0);
                reviewEssay(r.id, reading, writing);
              }}
            >
              Chấm 2 phần
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="proctor-tab-panel">
      <h3>Chấm bài thủ công</h3>
      {loading ? <p>Đang tải…</p> : <CbtDataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
    </div>
  );
}
