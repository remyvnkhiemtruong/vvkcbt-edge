import type { Request } from 'express';

/** Chuẩn hóa IP client (proxy-safe) để so khớp JWT binding. */
export function normalizeClientIp(raw: string | undefined | null): string {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
}

export function getClientIpFromRequest(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    (typeof forwarded === 'string' ? forwarded : Array.isArray(forwarded) ? forwarded[0] : undefined) ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';
  return normalizeClientIp(raw);
}

export function isIpBindingDisabled(): boolean {
  if (process.env.DISABLE_IP_BINDING === 'true') return true;
  // Dev/local: tránh mismatch IP qua Vite proxy (127.0.0.1 vs ::1 vs ::ffff:…)
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}
