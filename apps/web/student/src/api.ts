import { translateApiError } from '@shared/index';
import { useExamStore } from './store';

const API = import.meta.env.VITE_API_URL || '';

const examFetchOpts = { logoutOn401: false as const };

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  fetchOpts?: { logoutOn401?: boolean },
) {
  const token = localStorage.getItem('vnu_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api${path}`, { ...options, headers });
  if (res.status === 401 && fetchOpts?.logoutOn401 !== false) {
    useExamStore.getState().logout();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(translateApiError(err.message || 'Request failed'));
  }
  return res.json();
}

export const studentApi = {
  roomContext: () => apiFetch('/edge/room-context'),
  login: (account: string, pin: string, examSessionId?: string) =>
    apiFetch('/edge/login', {
      method: 'POST',
      body: JSON.stringify({
        examAccount: account,
        pin,
        ...(examSessionId ? { examSessionId } : {}),
      }),
    }),
  getExam: () => apiFetch('/edge/exam'),
  startExam: () => apiFetch('/edge/start-exam', { method: 'POST' }),
  /** Đồng bộ trong lúc thi — không logout khi 401 tạm (IP/locked). */
  syncExam: () => apiFetch('/edge/exam', {}, examFetchOpts),
  autosave: (answers: Record<string, unknown>, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    return apiFetch(
      '/edge/answers',
      {
        method: 'PATCH',
        body: JSON.stringify({ answers }),
        headers,
      },
      examFetchOpts,
    );
  },
  submit: () => apiFetch('/edge/submit', { method: 'POST' }, examFetchOpts),
  submitRetry: () => apiFetch('/edge/submit-retry', { method: 'POST' }, examFetchOpts),
  focusViolation: (reason?: string) =>
    apiFetch('/edge/focus-violation', { method: 'POST', body: JSON.stringify({ reason }) }, examFetchOpts),
  violationsBatch: (events: Array<{ reason?: string; at?: string }>) =>
    apiFetch('/edge/violations/batch', { method: 'POST', body: JSON.stringify({ events }) }, examFetchOpts),
  heartbeat: () => apiFetch('/edge/heartbeat', { method: 'POST' }, examFetchOpts),
  auditClick: (target: string) =>
    apiFetch('/edge/audit/click', { method: 'POST', body: JSON.stringify({ target }) }, examFetchOpts),
};
