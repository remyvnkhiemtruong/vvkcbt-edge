import fs from 'fs';
import path from 'path';

/** Đọc PORT từ .env gốc monorepo — proxy Vite theo cổng API thực tế. */
export function resolveApiProxyTarget(): string {
  const explicit =
    process.env.VITE_API_PROXY_TARGET ||
    process.env.API_PROXY_TARGET;
  if (explicit) return explicit.replace(/\/$/, '');

  const port = process.env.PORT || readEnvPort() || '3000';
  return `http://127.0.0.1:${port}`;
}

function readEnvPort(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../../.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^PORT\s*=\s*(\d+)/);
      if (m) return m[1];
    }
  }
  return null;
}

export const PROCTOR_DEV_PORT = 5174;
