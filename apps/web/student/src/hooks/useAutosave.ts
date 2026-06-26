import { useEffect, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { studentApi } from '../api';
import { useExamStore } from '../store';

const DEBOUNCE_MS = 300;
const FALLBACK_INTERVAL_SEC = 30;

export type SyncStatus = 'synced' | 'local' | 'offline';

export function useAutosave(_intervalSec = 3): SyncStatus {
  const answers = useExamStore((s) => s.answers);
  const sessionId = useExamStore((s) => s.sessionId);
  const submitted = useExamStore((s) => s.submitted);
  const syncStatus = useExamStore((s) => s.syncStatus);
  const setSyncStatus = useExamStore((s) => s.setSyncStatus);
  const lastSaved = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOnlineError = useRef(false);

  const persist = async (payload: Record<string, unknown>) => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;

    await set(`vnu_answers_${sessionId}`, { answers: payload, savedAt: new Date().toISOString() });

    if (!navigator.onLine) {
      lastOnlineError.current = true;
      setSyncStatus('offline');
      return;
    }

    try {
      await studentApi.autosave(payload);
      lastOnlineError.current = false;
      setSyncStatus('synced');
    } catch {
      lastOnlineError.current = true;
      setSyncStatus('local');
    }
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
        persist(answers).catch(() => {});
      }
    }, FALLBACK_INTERVAL_SEC * 1000);

    return () => clearInterval(id);
  }, [answers, sessionId, submitted]);

  useEffect(() => {
    const onOnline = () => {
      if (lastOnlineError.current) persist(answers).catch(() => {});
    };
    const onOffline = () => setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [answers, sessionId, submitted]);

  useEffect(() => {
    if (!sessionId) return;
    get(`vnu_answers_${sessionId}`).then((cached) => {
      const data = cached as { answers?: Record<string, unknown> } | Record<string, unknown> | undefined;
      const restored = data && 'answers' in data && data.answers ? data.answers : data;
      if (restored && typeof restored === 'object') {
        useExamStore.getState().setAnswers(restored as Record<string, unknown>);
      }
    });
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
