import type { ReactNode, CSSProperties } from 'react';

type CbtCardVariant = 'default' | 'grace' | 'passage' | 'danger';

interface CbtCardProps {
  children: ReactNode;
  variant?: CbtCardVariant;
  className?: string;
  style?: CSSProperties;
}

const variantStyles: Record<CbtCardVariant, CSSProperties> = {
  default: { background: '#fff', border: '1px solid var(--cbt-border)' },
  grace: { background: '#fff', border: '2px solid var(--cbt-grace-border)' },
  passage: { background: '#f8fafc', border: '2px solid var(--cbt-passage-border)' },
  danger: { background: 'var(--cbt-danger-bg)', border: '1px solid var(--cbt-danger-border)' },
};

export function CbtCard({ children, variant = 'default', className = '', style }: CbtCardProps) {
  return (
    <div
      className={`cbt-card ${className}`}
      style={{ ...variantStyles[variant], borderRadius: 'var(--cbt-radius)', padding: '1.25rem', ...style }}
    >
      {children}
    </div>
  );
}
