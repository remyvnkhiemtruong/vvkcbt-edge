import { vi } from '../i18n/vi';

export type MachineStatus = 'active' | 'offline' | 'warning' | 'empty';

interface CbtMachineCardProps {
  machineNo: number;
  status: MachineStatus;
  label?: string;
  onClick?: () => void;
}

const styles: Record<MachineStatus, { bg: string; border: string; color: string }> = {
  active: { bg: '#dcfce7', border: '#22c55e', color: '#166534' },
  offline: { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' },
  warning: { bg: '#fef3c7', border: '#f59e0b', color: '#92400e' },
  empty: { bg: '#f1f5f9', border: '#94a3b8', color: '#475569' },
};

export function mapProctorStatus(
  status: string,
  violations: number,
): { machineStatus: MachineStatus; label: string } {
  if (status === 'OFFLINE') return { machineStatus: 'offline', label: vi.proctor.offline };
  if (status === 'CHEATING' || violations > 0)
    return { machineStatus: 'warning', label: vi.proctor.violation };
  if (status === 'NOT_LOGGED_IN') return { machineStatus: 'empty', label: vi.proctor.empty };
  return { machineStatus: 'active', label: '' };
}

export function CbtMachineCard({ machineNo, status, label, onClick }: CbtMachineCardProps) {
  const s = styles[status];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        color: s.color,
        borderRadius: '10px',
        padding: '0.85rem 0.5rem',
        fontWeight: 700,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'center',
        minHeight: '72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '0.25rem',
        width: '100%',
      }}
    >
      <span>{vi.proctor.machine(machineNo)}</span>
      <span style={{ fontSize: '0.85rem' }}>{label || vi.proctor.noSbd}</span>
    </button>
  );
}
