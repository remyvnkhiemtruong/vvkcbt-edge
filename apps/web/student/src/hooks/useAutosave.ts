import { useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { studentApi } from '../api';
import { useExamStore } from '../store';

const DEBOUNCE_MS = 300;
const FALLBACK_INTERVAL_SEC = 30;
const QUEUE_KEY_PREFIX = 'vnu_autosave_queue_';

export type SyncStatus = 'synced' | 'local' | 'offline' | 'syncing';

interface QueuedBatch {
  idempotencyKey: string;
  answers: Record<string, unknown>;
  queuedAt: string;
}

async function loadQueue(sessionId: string): Promise<QueuedBatch[]> {
  const raw = await get(`${QUEUE_KEY_PREFIX}${sessionId}`);
  return Array.isArray(raw) ? (raw as QueuedBatch[]) : [];
}

async function saveQueue(sessionId: string, queue: QueuedBatch[]) {
  await set(`${QUEUE_KEY_PREFIX}${sessionId}`, queue);
}

export function useAutosave(_intervalSec = 3): SyncStatus {
  const answers = useExamStore((s) => s.answers);
  const sessionId = useExamStore((s) => s.sessionId);
  const submitted = useExamStore((s) => s.submitted);
  const syncStatus = useExamStore((s) => s.syncStatus);
  const setSyncStatus = useExamStore((s) => s.setSyncStatus);
  const lastSaved = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOnlineError = useRef(false);
  const flushing = useRef(false);

  const flushQueue = async (sid: string) => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      const queue = await loadQueue(sid);
      if (!queue.length) return;
      setSyncStatus('syncing');
      const remaining: QueuedBatch[] = [];
      for (const batch of queue) {
        try {
          await studentApi.autosave(batch.answers, batch.idempotencyKey);
        } catch {
          remaining.push(batch);
          break;
        }
      }
      await saveQueue(sid, remaining);
      if (!remaining.length) {
        lastOnlineError.current = false;
        setSyncStatus('synced');
      } else {
        lastOnlineError.current = true;
        setSyncStatus('local');
      }
    } finally {
      flushing.current = false;
    }
  };

  const persist = async (payload: Record<string, unknown>) => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;

    const savedAt = new Date().toISOString();
    await set(`vnu_answers_${sessionId}`, { answers: payload, savedAt });

    const idempotencyKey = `${sessionId}-${savedAt}`;
    const queue = await loadQueue(sessionId!);
    queue.push({ idempotencyKey, answers: payload, queuedAt: savedAt });
    await saveQueue(sessionId!, queue);

    if (!navigator.onLine) {
      lastOnlineError.current = true;
      setSyncStatus('offline');
      return;
    }

    await flushQueue(sessionId!);
  };

  useEffect(() => {
    if (!sessionId || submitted) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist(answers).catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [answers, sessionId, submitted]);

  useEffect(() => {
    if (!sessionId || submitted) return;

    const id = setInterval(() => {
      if (lastOnlineError.current || !navigator.onLine) {
        flushQueue(sessionId).catch(() => {});
      }
    }, FALLBACK_INTERVAL_SEC * 1000);

    return () => clearInterval(id);
  }, [sessionId, submitted]);

  useEffect(() => {
    const onOnline = () => {
      if (sessionId) flushQueue(sessionId).catch(() => {});
    };
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    get(`vnu_answers_${sessionId}`).then((cached) => {
      const data = cached as { answers?: Record<string, unknown> } | Record<string, unknown> | undefined;
      const restored = data && 'answers' in data && data.answers ? data.answers : data;
      if (restored && typeof restored === 'object') {
        useExamStore.getState().setAnswers(restored as Record<string, unknown>);
      }
    });
    flushQueue(sessionId).catch(() => {});
  }, [sessionId]);

  return syncStatus;
}

export function useSubmitRetry() {
  const submitted = useExamStore((s) => s.submitted);

  useEffect(() => {
    if (submitted) return;

    const handler = async () => {
      if (navigator.onLine) {
        try {
          await studentApi.submitRetry();
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [submitted]);
}
