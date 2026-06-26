import { useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { studentApi } from '../api';

const OUTBOX_KEY = 'vnu_submit_outbox';
const VIOLATION_OUTBOX_KEY = 'vnu_violation_outbox';

export async function enqueueSubmitOutbox(sessionId: string, payload: unknown) {
  const raw = (await get(OUTBOX_KEY)) as Array<{ sessionId: string; at: string }> | undefined;
  const list = raw ?? [];
  list.push({ sessionId, at: new Date().toISOString(), ...(payload as object) });
  await set(OUTBOX_KEY, list);
}

export async function flushSubmitOutbox() {
  if (!navigator.onLine) return;
  const raw = (await get(OUTBOX_KEY)) as Array<{ sessionId: string }> | undefined;
  if (!raw?.length) return;
  try {
    await studentApi.submitRetry();
    await set(OUTBOX_KEY, []);
  } catch {
    /* keep outbox */
  }
}

export async function enqueueViolation(reason?: string) {
  const raw = (await get(VIOLATION_OUTBOX_KEY)) as Array<{ reason?: string; at: string }> | undefined;
  const list = raw ?? [];
  list.push({ reason, at: new Date().toISOString() });
  await set(VIOLATION_OUTBOX_KEY, list);
}

export async function flushViolationOutbox() {
  if (!navigator.onLine) return;
  const raw = (await get(VIOLATION_OUTBOX_KEY)) as Array<{ reason?: string; at: string }> | undefined;
  if (!raw?.length) return;
  try {
    await studentApi.violationsBatch(raw);
    await set(VIOLATION_OUTBOX_KEY, []);
  } catch {
    /* keep */
  }
}

export function useOfflineSync() {
  useEffect(() => {
    const sync = () => {
      flushSubmitOutbox().catch(() => {});
      flushViolationOutbox().catch(() => {});
    };
    window.addEventListener('online', sync);
    sync();
    return () => window.removeEventListener('online', sync);
  }, []);
}
