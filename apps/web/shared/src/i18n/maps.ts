import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { vi } from './vi';

const subjectMap = Object.fromEntries(TN_THPT_SUBJECTS.map((s) => [s.code, s.nameVi]));

export function getSubjectNameVi(code: string): string {
  return subjectMap[code] ?? code;
}

export function formatSlotStatus(status: string): string {
  const key = status.toLowerCase() as keyof typeof vi.slotStatus;
  return vi.slotStatus[key] ?? status;
}

export function formatAuditEvent(type: string): string {
  const lower = type.toLowerCase() as keyof typeof vi.auditEvent;
  if (vi.auditEvent[lower]) return vi.auditEvent[lower];
  const upper = type as keyof typeof vi.auditEvent;
  return vi.auditEvent[upper] ?? type;
}

export function formatProctorAction(action: string): string {
  const key = action as keyof typeof vi.proctorAction;
  return vi.proctorAction[key] ?? action;
}

export function formatHealthCheckValue(key: string, val: string): string {
  const raw = String(val);
  if (raw === 'ok') return vi.proctor.system.checkOk;
  if (raw === 'error') return vi.proctor.system.checkFail;
  if (raw.startsWith('skipped')) return vi.proctor.system.checkSkipped;
  if (raw.startsWith('ok (')) return `Hoạt động bình thường (${raw.slice(4)})`;
  return raw;
}

export function formatAuditDetail(eventType: string, detail: string): string {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(detail || '{}') as Record<string, unknown>;
  } catch {
    return detail || '—';
  }

  const ev = eventType.toLowerCase();
  const sbd = payload.sbd != null ? String(payload.sbd) : '';
  const subject = payload.subject != null ? getSubjectNameVi(String(payload.subject)) : '';

  switch (ev) {
    case 'login':
      return [
        sbd && `SBD ${sbd}`,
        payload.examAccount != null && `tài khoản ${String(payload.examAccount)}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Thí sinh đăng nhập';
    case 'submit':
      return [
        sbd && `SBD ${sbd}`,
        subject && `môn ${subject}`,
        payload.total != null && `điểm ${String(payload.total)}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Nộp bài thành công';
    case 'autosave':
      return sbd ? `SBD ${sbd} — hệ thống tự lưu bài làm` : 'Hệ thống tự lưu bài làm';
    case 'click': {
      const target = String(payload.target ?? '');
      const q = target.match(/q-(\d+)/i);
      return q ? `Chọn câu hỏi số ${q[1]}` : target ? `Thao tác: ${target}` : 'Chọn câu hỏi';
    }
    case 'focus_violation':
      return payload.count != null
        ? `Vi phạm chuyển tab — lần thứ ${String(payload.count)}`
        : 'Vi phạm chuyển tab';
    case 'focus_lost':
      return 'Thí sinh rời khỏi cửa sổ bài thi';
    case 'fullscreen_exit':
      return 'Thí sinh thoát chế độ toàn màn hình';
    case 'help_request':
      return sbd ? `SBD ${sbd} gọi giám thị hỗ trợ` : 'Thí sinh gọi giám thị';
    case 'proctor_action': {
      const action = payload.action != null ? formatProctorAction(String(payload.action)) : 'điều khiển';
      const target = sbd ? `đối tượng SBD ${sbd}` : '';
      return [action, target].filter(Boolean).join(' — ');
    }
    case 'score_override':
      return [
        sbd && `SBD ${sbd}`,
        subject && `môn ${subject}`,
        payload.total != null && `điểm mới ${String(payload.total)}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Giám thị sửa điểm';
    case 'appeal_created':
      return [
        sbd && `SBD ${sbd}`,
        payload.subjectCode != null && `môn ${getSubjectNameVi(String(payload.subjectCode))}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Tạo đơn phúc khảo';
    case 'appeal_reviewed':
      return [
        sbd && `SBD ${sbd}`,
        payload.status != null && `trạng thái ${String(payload.status)}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Duyệt phúc khảo';
    default: {
      const parts = Object.entries(payload)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${String(v)}`);
      return parts.length ? parts.join(' · ') : '—';
    }
  }
}

export function formatMachineStatus(status: string): string {
  const key = status as keyof typeof vi.machineStatus;
  return vi.machineStatus[key] ?? status;
}

export function translateApiError(message: string): string {
  const trimmed = message?.trim() ?? '';
  const mapped = vi.apiErrors[trimmed as keyof typeof vi.apiErrors];
  if (mapped) return mapped;
  return trimmed || 'Đã xảy ra lỗi';
}
