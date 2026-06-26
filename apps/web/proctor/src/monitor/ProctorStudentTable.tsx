import { CbtDataTable, getSubjectNameVi } from '@shared/index';
import type { GridItemExtended } from '../post-exam/StudentDetailPanel';
import {
  formatPartScore,
  formatProctorSessionStatus,
  formatTotalScore,
  getProctorNotes,
  type ProctorMonitorRow,
} from './proctor-monitor-utils';

const ProctorActionType = {
  LOCK_EXAM: 'lock_exam',
  EXTEND_TIME: 'extend_time',
  FORCE_SUBMIT: 'force_submit',
  RESET_SESSION: 'reset_session',
} as const;

interface Props {
  rows: ProctorMonitorRow[];
  helpSbds: Set<string>;
  onSelect: (item: GridItemExtended) => void;
  onAction: (studentSessionId: string, action: string, payload?: Record<string, unknown>) => void;
}

export function ProctorStudentTable({ rows, helpSbds, onSelect, onAction }: Props) {
  const numberedRows = rows.map((r, i) => ({ ...r, stt: i + 1 }));

  return (
    <div className="proctor-student-table proctor-table-wrap">
      <CbtDataTable
        rowKey={(r) => r.id}
        rows={numberedRows}
        columns={[
          {
            key: 'stt',
            header: 'STT',
            align: 'center',
            render: (r) => r.stt,
          },
          {
            key: 'sbd',
            header: 'SBD',
            render: (r) => r.sbd || '—',
          },
          {
            key: 'name',
            header: 'Họ tên',
            render: (r) => r.fullName || '—',
          },
          {
            key: 'class',
            header: 'Lớp',
            render: (r) => r.className || '—',
          },
          {
            key: 'subject',
            header: 'Môn',
            render: (r) => (r.subjectCode ? getSubjectNameVi(r.subjectCode) : '—'),
          },
          {
            key: 'p1',
            header: 'P.I',
            align: 'right',
            render: (r) => formatPartScore(r.partScores?.part1),
          },
          {
            key: 'p2',
            header: 'P.II',
            align: 'right',
            render: (r) => formatPartScore(r.partScores?.part2),
          },
          {
            key: 'p3',
            header: 'P.III',
            align: 'right',
            render: (r) => formatPartScore(r.partScores?.part3),
          },
          {
            key: 'total',
            header: 'Tổng',
            align: 'right',
            render: (r) => <strong>{formatTotalScore(r)}</strong>,
          },
          {
            key: 'status',
            header: 'Trạng thái',
            render: (r) => formatProctorSessionStatus(r, helpSbds),
            dangerRow: (r) =>
              !!r.sbd &&
              (helpSbds.has(r.sbd) ||
                r.status === 'CHEATING' ||
                r.violations > 0 ||
                r.status === 'OFFLINE'),
          },
          {
            key: 'note',
            header: 'Ghi chú',
            render: (r) => (
              <span className="proctor-student-table__note">{getProctorNotes(r, helpSbds)}</span>
            ),
          },
          {
            key: 'actions',
            header: 'Điều khiển',
            render: (r) =>
              r.sbd ? (
                <div className="proctor-student-table__actions">
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-outline proctor-student-table__btn"
                    title="Khóa bài"
                    onClick={() => onAction(r.id, ProctorActionType.LOCK_EXAM)}
                  >
                    Khóa
                  </button>
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-outline proctor-student-table__btn"
                    title="Gia hạn 15 phút"
                    onClick={() =>
                      onAction(r.id, ProctorActionType.EXTEND_TIME, { minutes: 15 })
                    }
                  >
                    +15p
                  </button>
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-primary proctor-student-table__btn"
                    title="Nộp bài"
                    onClick={() => onAction(r.id, ProctorActionType.FORCE_SUBMIT)}
                  >
                    Nộp
                  </button>
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-outline proctor-student-table__btn"
                    title="Reset phiên"
                    onClick={() => onAction(r.id, ProctorActionType.RESET_SESSION)}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-outline proctor-student-table__btn"
                    title="Chi tiết"
                    onClick={() => onSelect(r)}
                  >
                    Chi tiết
                  </button>
                </div>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </div>
  );
}
