import { useMemo, useState } from 'react';
import { SO_GD_DISPLAY, SCHOOL_BRAND_DISPLAY, resolveSchoolLogoUrl } from '../i18n/brand';

export function CbtBrandLogo({
  size = 48,
  variant = 'header',
  showSchoolName = false,
  logoUrl,
  align = 'left',
  layout = 'inline',
}: {
  size?: number;
  variant?: 'login' | 'header';
  showSchoolName?: boolean;
  logoUrl?: string;
  align?: 'left' | 'center';
  /** inline: logo cạnh chữ; stack: logo trên, Sở/Trường dưới (dùng trên form đăng nhập) */
  layout?: 'inline' | 'stack';
}) {
  const px = variant === 'login' ? Math.max(size, 64) : size;
  const showText = showSchoolName;
  const src = useMemo(() => resolveSchoolLogoUrl(logoUrl), [logoUrl]);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`cbt-brand-logo cbt-brand-logo--${variant} cbt-brand-logo--align-${align} cbt-brand-logo--${layout}`}
    >
      {!failed && (
        <img
          src={src}
          alt={SCHOOL_BRAND_DISPLAY}
          width={px}
          height={px}
          className="cbt-brand-logo__img"
          style={{ objectFit: 'contain', width: px, height: px, maxHeight: px, flexShrink: 0 }}
          onError={() => setFailed(true)}
        />
      )}
      {showText && (
        <div className="cbt-brand-logo__text">
          <div className="cbt-brand-logo__dept">{SO_GD_DISPLAY}</div>
          <div className="cbt-brand-logo__school">{SCHOOL_BRAND_DISPLAY}</div>
        </div>
      )}
    </div>
  );
}
