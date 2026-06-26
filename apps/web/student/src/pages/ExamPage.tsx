import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  TimerBar,
  AudioPlayer,
  GracePeriodOverlay,
  CbtBrandLogo,
  ExamViewShell,
  vi,
  isRunningInSEB,
  type ExamQuestion,
  type ExamUiMode,
  ApiStatusBanner,
} from '@shared/index';
import { createSocket } from '@shared/socket';
import { useExamStore } from '../store';
import { studentApi } from '../api';
import { useFocusGuard } from '../hooks/useFocusGuard';
import { useExamLockdown } from '../hooks/useExamLockdown';
import { useAutosave, useSubmitRetry } from '../hooks/useAutosave';
import { countAnswered, SubmitSummaryPanel } from '../components/SubmitSummary';

const API = import.meta.env.VITE_API_URL || '';

function extractSharedPassage(questions: ExamQuestion[]): string | undefined {
  for (const q of questions) {
    const p =
      q.passage?.body ||
      q.content?.passage ||
      (q.content?.body as string | undefined);
    if (p?.trim()) return p;
  }
  return undefined;
}

export default function ExamPage() {
  const { exam, answers, locked, setExam, setAnswer, setLocked, setSubmitted, sessionId, sbd, examAccount } =
    useExamStore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(5400);
  const [totalSec, setTotalSec] = useState(5400);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const [uiOverride, setUiOverride] = useState<ExamUiMode | null>(null);
  const { blurred, violations } = useFocusGuard(true);

  const autosaveInterval = (exam?.rules as { proctoring?: { autosave_interval_sec?: number } })
    ?.proctoring?.autosave_interval_sec ?? 3;
  const syncStatus = useAutosave(autosaveInterval);
  useSubmitRetry();

  const loadExam = useCallback(async () => {
    const data = await studentApi.getExam();
    setExam(data);
    const durationMin = (data.rules as { durationMin?: number })?.durationMin ?? 90;
    const total = durationMin * 60;
    setTotalSec(total);
    if (data.endsAt && data.serverNow) {
      const rem = Math.max(
        0,
        Math.floor((new Date(data.endsAt as string).getTime() - new Date(data.serverNow as string).getTime()) / 1000),
      );
      setRemainingSec(rem || total);
    } else {
      setRemainingSec(total);
    }
  }, [setExam]);

  useEffect(() => {
    loadExam().catch(console.error);
  }, [loadExam]);

  useEffect(() => {
    const token = localStorage.getItem('vnu_token');
    const socket = createSocket('/proctoring', token ?? undefined);
    socketRef.current = socket;
    if (sessionId) socket.emit('join_student', { sessionId });

    socket.on('force_lock', () => setLocked(true));
    socket.on('force_submit', () => handleSubmit());
    socket.on('time_extend', (data: { minutes: number }) => {
      setRemainingSec((s) => s + (data.minutes ?? 5) * 60);
    });
    socket.on('reset_session', () => {
      useExamStore.getState().setAnswers({});
      setLocked(false);
      loadExam();
    });

    const hb = setInterval(() => {
      studentApi.heartbeat().catch(() => {});
      socket.emit('heartbeat', { sessionId });
    }, 5000);

    return () => {
      clearInterval(hb);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, setLocked, loadExam]);

  useEffect(() => {
    if (locked || !exam) return;
    const sync = setInterval(() => {
      studentApi
        .getExam()
        .then((data) => {
          if (data.endsAt && data.serverNow) {
            const rem = Math.max(
              0,
              Math.floor(
                (new Date(data.endsAt as string).getTime() - new Date(data.serverNow as string).getTime()) / 1000,
              ),
            );
            setRemainingSec(rem);
          }
        })
        .catch(() => {});
    }, 30000);
    const timer = setInterval(() => setRemainingSec((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
    };
  }, [locked, exam]);

  useEffect(() => {
    if (remainingSec === 0 && exam) handleSubmit();
  }, [remainingSec]);

  const questions = useMemo(
    () => ((exam?.questions as ExamQuestion[]) || []),
    [exam?.questions],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!exam) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
        setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
        setCurrentIdx((i) => Math.max(0, i - 1));
        e.preventDefault();
      }
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < questions.length) setCurrentIdx(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exam, questions.length]);

  const current = questions[currentIdx];
  const audioAssetId = (current?.content as { audio_id?: string })?.audio_id;

  useEffect(() => {
    if (!audioAssetId) {
      setAudioUrl(null);
      return;
    }
    const token = localStorage.getItem('vnu_token');
    fetch(`${API}/api/infra/audio/${audioAssetId}/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((d) => setAudioUrl(`${API}/api/infra/audio/stream/${d.token}`))
      .catch(() => setAudioUrl(null));
  }, [audioAssetId, sessionId]);

  const handleSubmit = async () => {
    if (submitting || locked) return;
    if (!confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    setSubmitting(true);
    try {
      await studentApi.autosave(answers);
      const result = await studentApi.submit();
      setSubmitted(result, !!(result as { hasMoreSlots?: boolean }).hasMoreSlots);
      setGracePeriod(false);
    } catch {
      setGracePeriod(true);
      setRetryAttempt((a) => a + 1);
      const retry = async () => {
        try {
          await studentApi.submitRetry();
          const result = await studentApi.submit();
          setSubmitted(result, !!(result as { hasMoreSlots?: boolean }).hasMoreSlots);
          setGracePeriod(false);
        } catch {
          setRetryAttempt((a) => a + 1);
        }
      };
      retry();
      const id = setInterval(retry, 8000);
      setTimeout(() => clearInterval(id), 120000);
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  const proctoring = (exam?.rules as { proctoring?: Record<string, boolean> })?.proctoring;
  useExamLockdown(
    !!exam && !locked,
    proctoring?.block_copy_paste !== false,
    proctoring?.block_context_menu !== false,
  );

  useEffect(() => {
    if (!exam || locked || isRunningInSEB()) return;
    if (proctoring?.require_fullscreen !== false && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, [exam, locked, proctoring?.require_fullscreen]);

  if (!exam) return <div className="loading">{vi.exam.loading}</div>;

  const defaultUi = ((exam.rules as { uiMode?: ExamUiMode })?.uiMode ?? 'vertical_focus') as ExamUiMode;
  const uiMode = uiOverride ?? defaultUi;
  const subjectLabel = (exam.title as string) || vi.exam.defaultTitle;
  const sharedPassage = extractSharedPassage(questions);
  const audioRules = (exam.rules as { audio?: { max_plays?: number } })?.audio;
  const maxViolations =
    (exam?.rules as { proctoring?: { max_focus_violations?: number } })?.proctoring
      ?.max_focus_violations ?? 3;

  const watermarkText =
    proctoring?.watermark !== false && (sbd || examAccount)
      ? `${sbd ?? ''} · ${(examAccount ?? '').slice(-4).padStart(4, '*')}`
      : '';

  const syncLabel =
    syncStatus === 'synced'
      ? vi.exam.syncSynced
      : syncStatus === 'syncing'
        ? 'Đang đồng bộ…'
        : syncStatus === 'local'
          ? vi.exam.syncLocal
          : vi.exam.syncOffline;

  return (
    <div className={`exam-page mode-${uiMode}`} style={{ userSelect: 'none' }}>
      <ApiStatusBanner pollMs={8000} />
      {watermarkText && (
        <div
          className="exam-watermark"
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            opacity: 0.06,
            fontSize: '1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3rem',
            padding: '2rem',
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i}>{watermarkText}</span>
          ))}
        </div>
      )}
      <GracePeriodOverlay visible={gracePeriod} retryAttempt={retryAttempt} />

      {confirmSubmit && !submitting && (
        <SubmitSummaryPanel
          {...countAnswered(questions, answers)}
          remainingSec={remainingSec}
        />
      )}

      {blurred && (
        <div className="focus-overlay">
          <p>{vi.exam.focusWarning}</p>
          <p>{vi.exam.violationCount(violations, maxViolations)}</p>
        </div>
      )}
      {locked && <div className="lock-overlay">{vi.exam.locked}</div>}

      <header className="exam-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CbtBrandLogo size={44} logoUrl="/student/branding/logo.png" />
          <h2>{subjectLabel.toUpperCase()}</h2>
        </div>
        <div className="header-actions">
          <span
            className="exam-sync-badge"
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.5rem',
              borderRadius: 4,
              background:
                syncStatus === 'synced' ? '#dcfce7' : syncStatus === 'local' ? '#fef9c3' : '#fee2e2',
              color: syncStatus === 'synced' ? '#166534' : syncStatus === 'local' ? '#854d0e' : '#991b1b',
            }}
          >
            {syncLabel}
          </span>
          <button
            type="button"
            className="cbt-btn cbt-btn-outline"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            onClick={() =>
              socketRef.current?.emit('help_request', {
                sessionId,
                reason: vi.exam.callProctorReason,
              })
            }
          >
            {vi.exam.callProctor}
          </button>
          <span
            className="exam-meta"
            style={{ color: remainingSec < 300 ? '#dc2626' : undefined, fontWeight: remainingSec < 300 ? 700 : 400 }}
          >
            {vi.exam.timeLabel}: {Math.floor(remainingSec / 60)}:
            {String(remainingSec % 60).padStart(2, '0')}
          </span>
          <button
            type="button"
            className="toggle-view"
            aria-label={vi.exam.viewModeLabel}
            onClick={() =>
              setUiOverride((m) =>
                (m ?? defaultUi) === 'split_view' ? 'vertical_focus' : 'split_view',
              )
            }
          >
            {uiMode === 'split_view' ? vi.exam.toggleVertical : vi.exam.toggleSplit}
          </button>
          <TimerBar remainingSec={remainingSec} totalSec={totalSec} />
        </div>
      </header>

      <AudioPlayer
        url={audioUrl}
        maxPlays={audioRules?.max_plays ?? 2}
        audioIndex={1}
        questionFrom={1}
        questionTo={5}
      />

      <ExamViewShell
        questions={questions}
        answers={answers}
        uiMode={uiMode}
        sharedPassage={sharedPassage}
        currentIdx={currentIdx}
        onCurrentIdxChange={setCurrentIdx}
        onChange={(id, a) => setAnswer(id, a)}
        onQuestionClick={(i) => studentApi.auditClick(`q-${i}`).catch(() => {})}
      />

      <footer className="exam-footer">
        <span className="kbd-hint">{vi.exam.kbdHint}</span>
        <button
          type="button"
          className="cbt-btn cbt-btn-primary"
          onClick={handleSubmit}
          disabled={locked || submitting}
        >
          {submitting ? vi.exam.submitting : confirmSubmit ? vi.exam.confirmSubmit : vi.exam.submit}
        </button>
        {confirmSubmit && !submitting && (
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setConfirmSubmit(false)}>
            {vi.exam.cancel}
          </button>
        )}
      </footer>
    </div>
  );
}
