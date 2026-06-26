import { translateApiError } from '@shared/index';

const API = import.meta.env.VITE_API_URL ?? '';

export const TOKEN_KEY = 'vnu_proctor_token';
export const SESSION_EXPIRED_MSG = 'Phiên đăng nhập hết hạn — vui lòng đăng nhập lại';

export function getProctorToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setProctorToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearProctorToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isProctorTokenUsable(token: string | null): boolean {
  if (!token?.trim()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
      role?: string;
    };
    if (payload.role !== 'proctor' && payload.role !== 'admin') return false;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() + 60_000) return false;
    return true;
  } catch {
    return false;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string };
    return j.message ?? text;
  } catch {
    return text || res.statusText;
  }
}

export async function proctorFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API}/api${path}`, { ...init, headers });
  if (res.status === 401) {
    clearProctorToken();
    throw new Error(SESSION_EXPIRED_MSG);
  }
  if (!res.ok) {
    throw new Error(translateApiError(await readErrorMessage(res)));
  }
  return res;
}

export async function verifyProctorSession(token: string): Promise<boolean> {
  if (!isProctorTokenUsable(token)) return false;
  try {
    await proctorFetch('/auth/proctor/me', token);
    return true;
  } catch {
    clearProctorToken();
    return false;
  }
}

export function handleProctorApiError(err: unknown, onSessionExpired?: () => void): string {
  const raw = err instanceof Error ? err.message : 'Lỗi';
  const msg = translateApiError(raw);
  if (msg === SESSION_EXPIRED_MSG) onSessionExpired?.();
  return msg;
}

export async function proctorLogin(username: string, password: string) {
  const res = await fetch(`${API}/api/auth/proctor/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = await res.json();
  setProctorToken(data.token);
  return data;
}

export async function proctorApi<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await proctorFetch(path, token, { ...init, headers });
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json() as Promise<T>;
  return res.text() as unknown as T;
}

export async function downloadProctorFile(path: string, token: string, filename: string) {
  const res = await proctorFetch(path, token);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
