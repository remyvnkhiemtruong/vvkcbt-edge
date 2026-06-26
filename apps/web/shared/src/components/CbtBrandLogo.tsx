const SO_GD =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_SO_GD_NAME?: string } }).env?.VITE_SO_GD_NAME) ||
  'Sở GDĐT Cà Mau';
const SCHOOL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_SCHOOL_NAME?: string } }).env?.VITE_SCHOOL_NAME) ||
  'Trường THPT Võ Văn Kiệt';

export function CbtBrandLogo({
  size = 48,
  variant = 'header',
  showSchoolName = false,
  logoUrl = '/student/branding/logo.png',
}: {
  size?: number;
  variant?: 'login' | 'header';
  showSchoolName?: boolean;
  logoUrl?: string;
}) {
  const px = variant === 'login' ? Math.max(size, 80) : size;
  return (
    <div
      className={`cbt-brand-logo cbt-brand-logo--${variant}`}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <img
        src={logoUrl}
        alt={SCHOOL}
        width={px}
        height={px}
        style={{ objectFit: 'contain', maxHeight: px }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {(showSchoolName || variant === 'login') && (
        <div style={{ lineHeight: 1.2 }}>
          {variant === 'login' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--cbt-text-muted, #64748b)' }}>{SO_GD}</div>
          )}
          <div style={{ fontWeight: 700, fontSize: variant === 'login' ? '0.95rem' : '0.8rem' }}>{SCHOOL}</div>
        </div>
      )}
    </div>
  );
}
