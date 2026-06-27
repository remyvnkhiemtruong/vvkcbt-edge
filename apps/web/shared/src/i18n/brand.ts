const DEFAULT_SO_GD = 'SỞ GIÁO DỤC VÀ ĐÀO TẠO CÀ MAU';
const DEFAULT_SCHOOL_BRAND = 'TRƯỜNG THPT VÕ VĂN KIỆT';

function readViteEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    return (import.meta as { env?: Record<string, string | undefined> }).env?.[key]?.trim() || undefined;
  }
  return undefined;
}

function viteBaseUrl(): string {
  const base =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
      : '/';
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Đường dẫn logo trường (LogoVVK.png) theo base Vite của từng SPA. */
export function resolveSchoolLogoUrl(override?: string): string {
  const custom = override?.trim() || readViteEnv('VITE_SCHOOL_LOGO_URL');
  if (custom) return custom;
  return `${viteBaseUrl()}branding/logo.png`;
}

/** Alias PNG — cùng file logo.png trong public/branding. */
export function resolveSchoolLogoPngUrl(override?: string): string {
  return resolveSchoolLogoUrl(override);
}

export const SCHOOL_LOGO_URL = resolveSchoolLogoUrl();
export const SCHOOL_LOGO_PNG_URL = resolveSchoolLogoPngUrl();

export const SO_GD_DISPLAY = readViteEnv('VITE_SO_GD_NAME') || DEFAULT_SO_GD;
export const SCHOOL_BRAND_DISPLAY = readViteEnv('VITE_SCHOOL_BRAND_NAME') || DEFAULT_SCHOOL_BRAND;
