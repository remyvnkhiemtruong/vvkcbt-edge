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
  const key = type as keyof typeof vi.auditEvent;
  return vi.auditEvent[key] ?? type;
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
