import { DEFAULT_SCHOOL_NAME } from '@vnu/shared-types';

const env =
  typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined;

const SO_GD = env?.VITE_SO_GD_NAME || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO TỈNH CÀ MAU';
const SCHOOL_BRAND = env?.VITE_SCHOOL_BRAND_NAME || DEFAULT_SCHOOL_NAME;

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
  const isLogin = variant === 'login';
  const px = isLogin ? Math.max(size, 80) : size;

  return (
    <div
      className={`cbt-brand-logo cbt-brand-logo--${variant}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isLogin ? '0.65rem' : '0.5rem',
        ...(isLogin ? { flexDirection: 'column', textAlign: 'center' } : {}),
      }}
    >
      <img
        src={logoUrl}
        alt={SCHOOL_BRAND}
        width={px}
        height={px}
        style={{ objectFit: 'contain', maxHeight: px }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {showSchoolName && (
        <div className="cbt-brand-logo__text">
          <div className="cbt-brand-logo__sogd">{SO_GD}</div>
          <div className="cbt-brand-logo__school">{SCHOOL_BRAND}</div>
        </div>
      )}
    </div>
  );
}
