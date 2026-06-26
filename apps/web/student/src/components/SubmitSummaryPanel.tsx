import { formatRemaining } from '@shared/index';

interface SubmitSummaryPanelProps {
  answered: number;
  total: number;
  remainingSec: number;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}

export function SubmitSummaryPanel({
  answered,
  total,
  remainingSec,
  onConfirm,
  onCancel,
  confirming = false,
}: SubmitSummaryPanelProps) {
  const unanswered = total - answered;
  return (
    <div
      role="dialog"
      aria-labelledby="submit-summary-title"
      aria-modal="true"
      className="submit-dialog-overlay"
      onClick={() => !confirming && onCancel()}
    >
      <div className="submit-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 id="submit-summary-title">Xác nhận nộp bài</h3>
        <p>Bạn có chắc chắn muốn nộp bài? Sau khi nộp bạn không thể sửa đáp án.</p>
        <ul>
          <li>
            Đã làm: <strong>{answered}</strong> / {total} câu
          </li>
          <li>
            Chưa trả lời: <strong>{unanswered}</strong> câu
          </li>
          <li>
            Thời gian còn lại: <strong>{formatRemaining(remainingSec)}</strong>
          </li>
        </ul>
        {unanswered > 0 && (
          <p className="submit-dialog__warn">Bạn còn câu chưa làm — hãy kiểm tra lại trước khi nộp.</p>
        )}
        <div className="submit-dialog__actions">
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={onCancel} disabled={confirming}>
            Hủy
          </button>
          <button type="button" className="exam-submit-header-btn" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Đang nộp...' : 'Xác nhận nộp bài'}
          </button>
        </div>
      </div>
    </div>
  );
}
