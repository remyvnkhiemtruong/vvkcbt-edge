import type { GridItemExtended } from '../post-exam/StudentDetailPanel';

export type ProctorMonitorRow = GridItemExtended;

export function formatProctorSessionStatus(item: GridItemExtended, helpSbds: Set<string>): string {
  if (!item.sbd) return '—';
  if (helpSbds.has(item.sbd)) return 'Cần hỗ trợ';
  if (item.status === 'CHEATING') return 'Vi phạm';
  if (item.locked || item.status === 'LOCKED') return 'Đã khóa';
  if (item.submitted || item.status === 'SUBMITTED') return 'Đã nộp';
  if (item.status === 'OFFLINE' || item.status === 'offline') return 'Mất mạng';
  if (item.status === 'ACTIVE') return 'Đang thi';
  if (item.status === 'NOT_LOGGED_IN') return 'Chưa đăng nhập';
  return item.status;
}

export function getProctorNotes(item: GridItemExtended, helpSbds: Set<string>): string {
  const parts: string[] = [];
  if (helpSbds.has(item.sbd)) parts.push('Yêu cầu hỗ trợ');
  if (item.violations > 0) parts.push(`${item.violations} VP tab`);
  if (item.locked) parts.push('Giám thị đã khóa');
  if (
    item.answeredCount != null &&
    item.questionCount != null &&
    item.questionCount > 0 &&
    !item.submitted
  ) {
    parts.push(`Đã làm ${item.answeredCount}/${item.questionCount}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

export function formatPartScore(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

export function formatTotalScore(item: GridItemExtended): string {
  if (item.scoreTotal == null) return '—';
  return item.scoreTotal.toFixed(2);
}

/** Chỉ thí sinh có trong ca — không pad theo số máy phòng. */
export function buildMonitorRows(
  grid: GridItemExtended[],
  matchesGrid: (item: GridItemExtended) => boolean,
): ProctorMonitorRow[] {
  return grid.filter(matchesGrid);
}
