import { useCallback, useEffect, useRef, useState } from 'react';
import { studentApi } from '../api';
import { useExamStore } from '../store';
import { enqueueSubmitOutbox } from './useOffline';

const RETRY_INTERVAL_MS = 8000;

export function useExamSubmit(sessionId: string | null) {
  const locked = useExamStore((s) => s.locked);
  const setSubmitted = useExamStore((s) => s.setSubmitted);

  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(1);

  const submittingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitDoneRef = useRef(false);

  const stopRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopRetry(), [stopRetry]);

  const finishSubmit = useCallback(
    (result: Record<string, unknown>) => {
      setSubmitted(result, !!(result as { hasMoreSlots?: boolean }).hasMoreSlots);
      setGracePeriod(false);
      setConfirmSubmit(false);
      stopRetry();
      submittingRef.current = false;
      setSubmitting(false);
    },
    [setSubmitted, stopRetry],
  );

  const attemptSubmit = useCallback(async () => {
    await studentApi.autosave(useExamStore.getState().answers);
    return studentApi.submit();
  }, []);

  const startRetryLoop = useCallback(() => {
    if (retryTimerRef.current) return;

    setGracePeriod(true);
    setConfirmSubmit(false);
    setRetryAttempt(1);

    if (sessionId) {
      enqueueSubmitOutbox(sessionId, { answers: useExamStore.getState().answers }).catch(() => {});
    }

    const retryOnce = async () => {
      try {
        await studentApi.submitRetry();
        const result = await attemptSubmit();
        finishSubmit(result);
      } catch {
        setRetryAttempt((n) => n + 1);
      }
    };

    void retryOnce();
    retryTimerRef.current = setInterval(() => void retryOnce(), RETRY_INTERVAL_MS);
  }, [sessionId, attemptSubmit, finishSubmit]);

  const confirmSubmitExam = useCallback(async () => {
    if (submittingRef.current || locked) return;
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmSubmit(false);

    try {
      const result = await attemptSubmit();
      finishSubmit(result);
    } catch {
      startRetryLoop();
    }
  }, [locked, attemptSubmit, finishSubmit, startRetryLoop]);

  const requestSubmit = useCallback(() => {
    if (submittingRef.current || locked || gracePeriod) return;
    setConfirmSubmit(true);
  }, [locked, gracePeriod]);

  const cancelSubmit = useCallback(() => {
    if (submittingRef.current) return;
    setConfirmSubmit(false);
  }, []);

  const triggerAutoSubmit = useCallback(() => {
    if (autoSubmitDoneRef.current || submittingRef.current || locked) return;
    autoSubmitDoneRef.current = true;
    void confirmSubmitExam();
  }, [confirmSubmitExam, locked]);

  useEffect(() => {
    if (!gracePeriod) return;

    const onOnline = () => {
      void (async () => {
        try {
          await studentApi.submitRetry();
          const result = await attemptSubmit();
          finishSubmit(result);
        } catch {
          setRetryAttempt((n) => n + 1);
        }
      })();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [gracePeriod, attemptSubmit, finishSubmit]);

  return {
    submitting,
    confirmSubmit,
    gracePeriod,
    retryAttempt,
    requestSubmit,
    cancelSubmit,
    confirmSubmitExam,
    triggerAutoSubmit,
  };
}
