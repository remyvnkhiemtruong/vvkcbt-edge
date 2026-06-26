import { CbtPageShell, CbtBrandLogo, vi, getSubjectNameVi } from '@shared/index';
import { useExamStore } from '../store';

export default function ResultPage() {
  const scoreResult = useExamStore((s) => s.scoreResult);
  const hasMoreSlots = useExamStore((s) => s.hasMoreSlots);
  const logout = useExamStore((s) => s.logout);
  const continueToWaitingRoom = useExamStore((s) => s.continueToWaitingRoom);

  const subjectLabel = scoreResult?.subject
    ? getSubjectNameVi(scoreResult.subject)
    : '';
  const pending = scoreResult?.pendingManual;
  const parts = scoreResult?.partScores;

  return (
    <CbtPageShell headerTitle={vi.result.title} headerLeft={<CbtBrandLogo size={40} />}>
      <div className="result-page">
        <h2>Đã nộp bài thành công</h2>
        {subjectLabel && (
          <p>
            Môn: <strong>{subjectLabel}</strong>
          </p>
        )}
        {pending ? (
          <p className="admin-hint" style={{ fontSize: '1.1rem' }}>
            Bài thi Ngữ văn — <strong>Chấm sau</strong>
          </p>
        ) : (
          <>
            <p className="total-score">
              {vi.result.totalScore}: {scoreResult?.total?.toFixed(2) ?? '—'}
            </p>
            {parts && (
              <div className="part-scores" style={{ marginTop: '1rem' }}>
                <p>
                  {vi.result.part} I: {parts.part1.toFixed(2)} / {parts.maxPart1.toFixed(2)}
                </p>
                <p>
                  {vi.result.part} II: {parts.part2.toFixed(2)} / {parts.maxPart2.toFixed(2)}
                </p>
                <p>
                  {vi.result.part} III: {parts.part3.toFixed(2)} / {parts.maxPart3.toFixed(2)}
                </p>
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          {hasMoreSlots && (
            <button type="button" className="cbt-btn cbt-btn-primary" onClick={continueToWaitingRoom}>
              {vi.result.continue}
            </button>
          )}
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={logout}>
            {vi.result.finish}
          </button>
        </div>
      </div>
    </CbtPageShell>
  );
}
