import { translateApiError } from '@shared/index';

const API = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('vnu_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api${path}`, { ...options, headers });
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
  listSlots: () => apiFetch('/edge/slots'),
  startSlot: (slotId: string) =>
    apiFetch(`/edge/slots/${slotId}/start`, { method: 'POST' }),
  getExam: () => apiFetch('/edge/exam'),
  autosave: (answers: Record<string, unknown>, idempotencyKey?: string) => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    return apiFetch('/edge/answers', {
      method: 'PATCH',
      body: JSON.stringify({ answers }),
      headers,
    });
  },
  submit: () => apiFetch('/edge/submit', { method: 'POST' }),
  submitRetry: () => apiFetch('/edge/submit-retry', { method: 'POST' }),
  focusViolation: (reason?: string) =>
    apiFetch('/edge/focus-violation', { method: 'POST', body: JSON.stringify({ reason }) }),
  violationsBatch: (events: Array<{ reason?: string; at?: string }>) =>
    apiFetch('/edge/violations/batch', { method: 'POST', body: JSON.stringify({ events }) }),
  prefetch: (slotId: string) => apiFetch(`/edge/prefetch/${slotId}`),
  heartbeat: () => apiFetch('/edge/heartbeat', { method: 'POST' }),
  auditClick: (target: string) =>
    apiFetch('/edge/audit/click', { method: 'POST', body: JSON.stringify({ target }) }),
};
