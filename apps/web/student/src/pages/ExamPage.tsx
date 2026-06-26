import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  AudioPlayer,
  GracePeriodOverlay,
  CbtBrandLogo,
  ExamViewShell,
  ExamQuestionPalette,
  ExamThemeToggle,
  useExamTheme,
  vi,
  isRunningInSEB,
  getSubjectNameVi,
  buildExamParts,
  findPartIndex,
  countAnswered,
  type ExamQuestion,
  type ExamUiMode,
  ApiStatusBanner,
} from '@shared/index';
import { createSocket } from '@shared/socket';
import { useExamStore } from '../store';
import { studentApi } from '../api';
import { useFocusGuard } from '../hooks/useFocusGuard';
import { useExamLockdown } from '../hooks/useExamLockdown';
import { useAutosave } from '../hooks/useAutosave';
import { useExamSubmit } from '../hooks/useExamSubmit';
import { SubmitSummaryPanel } from '../components/SubmitSummaryPanel';

const API = import.meta.env.VITE_API_URL || '';
const FONT_SCALES = [0.9, 1, 1.1, 1.2] as const;

function formatTimer(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExamPage() {
  const { exam, answers, locked, setExam, setAnswer, setLocked, sessionId, sbd, examAccount } =
    useExamStore();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSec, setRemainingSec] = useState(5400);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const [uiOverride, setUiOverride] = useState<ExamUiMode | null>(null);
  const [fontScaleIdx, setFontScaleIdx] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme, isDark, toggle: toggleTheme } = useExamTheme();
  const { blurred, violations } = useFocusGuard(true);

  const autosaveInterval = (exam?.rules as { proctoring?: { autosave_interval_sec?: number } })
    ?.proctoring?.autosave_interval_sec ?? 3;
  const syncStatus = useAutosave(autosaveInterval);

  const {
    submitting,
    confirmSubmit,
    gracePeriod,
    retryAttempt,
    requestSubmit,
    cancelSubmit,
    confirmSubmitExam,
    triggerAutoSubmit,
  } = useExamSubmit(sessionId);

  const loadExam = useCallback(async () => {
    const data = await studentApi.getExam();
    setExam(data);
    const durationMin = (data.rules as { durationMin?: number })?.durationMin ?? 90;
    const total = durationMin * 60;
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
    socket.on('force_submit', () => confirmSubmitExam());
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
  }, [sessionId, setLocked, loadExam, confirmSubmitExam]);

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
    if (remainingSec === 0 && exam && !locked) triggerAutoSubmit();
  }, [remainingSec, exam, locked, triggerAutoSubmit]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const questions = useMemo(() => ((exam?.questions as ExamQuestion[]) || []), [exam?.questions]);
  const partOrder = useMemo(() => {
    const parts = (exam?.rules as { structureTemplate?: { parts?: Record<string, unknown> } })
      ?.structureTemplate?.parts;
    return parts ? Object.keys(parts) : undefined;
  }, [exam?.rules]);
  const parts = useMemo(() => buildExamParts(questions, partOrder), [questions, partOrder]);
  const answeredStats = useMemo(() => countAnswered(questions, answers), [questions, answers]);

  const scrollToQuestion = useCallback((idx: number) => {
    requestAnimationFrame(() => {
      document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const goPart = useCallback(
    (delta: number) => {
      const pIdx = findPartIndex(parts, currentIdx);
      const next = pIdx + delta;
      if (next >= 0 && next < parts.length) {
        const target = parts[next].start;
        setCurrentIdx(target);
        scrollToQuestion(target);
      }
    },
    [parts, currentIdx, scrollToQuestion],
  );

  const goQuestion = useCallback(
    (delta: number) => {
      const pIdx = findPartIndex(parts, currentIdx);
      const part = parts[pIdx];
      if (!part) return;
      const nextIdx = currentIdx + delta;
      if (nextIdx >= part.start && nextIdx <= part.end) {
        setCurrentIdx(nextIdx);
        scrollToQuestion(nextIdx);
        return;
      }
      if (delta > 0 && pIdx + 1 < parts.length) {
        const target = parts[pIdx + 1].start;
        setCurrentIdx(target);
        scrollToQuestion(target);
      } else if (delta < 0 && pIdx > 0) {
        const target = parts[pIdx - 1].end;
        setCurrentIdx(target);
        scrollToQuestion(target);
      }
    },
    [parts, currentIdx, scrollToQuestion],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!exam || confirmSubmit) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j') {
        goQuestion(1);
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k') {
        goQuestion(-1);
        e.preventDefault();
      }
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < questions.length) {
          setCurrentIdx(idx);
          scrollToQuestion(idx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exam, questions.length, goQuestion, confirmSubmit, scrollToQuestion]);

  const audioQuestionRange = useMemo(() => {
    const indices: number[] = [];
    questions.forEach((q, i) => {
      if ((q.content as { audio_id?: string })?.audio_id) indices.push(i);
    });
    if (indices.length === 0) return { from: 1, to: 1, index: 1 };
    const from = indices[0] + 1;
    const to = indices[indices.length - 1] + 1;
    const audioIdx = indices.findIndex((i) => i === currentIdx);
    return { from, to, index: audioIdx >= 0 ? audioIdx + 1 : 1 };
  }, [questions, currentIdx]);

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

  const handleSubmit = () => requestSubmit();

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
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

  const defaultUi = ((exam?.rules as { uiMode?: ExamUiMode })?.uiMode ?? 'vertical_focus') as ExamUiMode;
  const uiMode = uiOverride ?? defaultUi;

  useEffect(() => {
    if (!exam) return;
    requestAnimationFrame(() => {
      document.getElementById(`q-${currentIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [currentIdx, uiMode, exam]);

  if (!exam) return <div className="loading">{vi.exam.loading}</div>;
  const subjectCode = (exam.subject as string) || '';
  const subjectLabel = subjectCode
    ? `ĐỀ ${getSubjectNameVi(subjectCode).toUpperCase()}`
    : vi.exam.defaultTitle;
  const sessionName = (exam.sessionName as string) || '';
  const audioRules = (exam.rules as { audio?: { max_plays?: number } })?.audio;
  const maxViolations =
    (exam?.rules as { proctoring?: { max_focus_violations?: number } })?.proctoring?.max_focus_violations ?? 3;

  const watermarkText =
    proctoring?.watermark !== false && (sbd || examAccount)
      ? `${sbd ?? ''} · ${(examAccount ?? '').slice(-4).padStart(4, '*')}`
      : '';

  const syncTitle =
    syncStatus === 'synced'
      ? vi.exam.syncSynced
      : syncStatus === 'syncing'
        ? 'Đang đồng bộ…'
        : syncStatus === 'local'
          ? vi.exam.syncLocal
          : vi.exam.syncOffline;

  const partIdx = findPartIndex(parts, currentIdx);
  const canGoBack = partIdx > 0;
  const canGoNext = partIdx < parts.length - 1 && parts.length > 0;

  return (
    <div className="exam-page" data-exam-theme={theme} style={{ userSelect: 'none' }}>
      <ApiStatusBanner pollMs={8000} />
      {watermarkText && (
        <div className="exam-watermark" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i}>{watermarkText}</span>
          ))}
        </div>
      )}
      <GracePeriodOverlay visible={gracePeriod} retryAttempt={retryAttempt} />

      {confirmSubmit && !gracePeriod && (
        <SubmitSummaryPanel
          {...answeredStats}
          remainingSec={remainingSec}
          onConfirm={confirmSubmitExam}
          onCancel={cancelSubmit}
          confirming={submitting}
        />
      )}

      {blurred && (
        <div className="focus-overlay">
          <p>{vi.exam.focusWarning}</p>
          <p>{vi.exam.violationCount(violations, maxViolations)}</p>
        </div>
      )}
      {locked && <div className="lock-overlay">{vi.exam.locked}</div>}

      <header className="exam-topbar">
        <div className="exam-topbar__left">
          <div className="exam-topbar__brand">
            <CbtBrandLogo size={40} logoUrl="/student/branding/logo.png" />
            <div className="exam-topbar__subject-wrap">
              <span className="exam-topbar__subject">{subjectLabel}</span>
              <span className="exam-topbar__school">{vi.footerPublic}</span>
            </div>
          </div>
        </div>

        <div className="exam-topbar__center">
          <button
            type="button"
            className="exam-nav-btn exam-nav-btn--outline"
            disabled={!canGoBack || locked}
            onClick={() => goPart(-1)}
          >
            {vi.exam.back}
          </button>
          <button
            type="button"
            className="exam-nav-btn exam-nav-btn--primary"
            disabled={!canGoNext || locked}
            onClick={() => goPart(1)}
          >
            {vi.exam.next}
          </button>
        </div>

        <div className="exam-topbar__right">
          {sessionName && <span className="exam-topbar__session">{sessionName}</span>}
          <span className={`exam-sync-dot sync-${syncStatus}`} title={syncTitle} aria-label={syncTitle} />
          <ExamThemeToggle isDark={isDark} onToggle={toggleTheme} />
          <button
            type="button"
            className="exam-icon-btn"
            title={vi.exam.callProctor}
            onClick={() =>
              socketRef.current?.emit('help_request', {
                sessionId,
                reason: vi.exam.callProctorReason,
              })
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 3.5c-.9.9-1.5 1.2-1.5 2.5M12 17h.01" />
            </svg>
          </button>
          <span className={`exam-timer ${remainingSec < 300 ? 'urgent' : ''}`}>
            <span className="exam-timer__icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            {formatTimer(remainingSec)}
          </span>
          <button
            type="button"
            className="exam-submit-header-btn"
            onClick={handleSubmit}
            disabled={locked || submitting || gracePeriod}
          >
            {submitting ? vi.exam.submitting : 'Nộp bài'}
          </button>
          <button
            type="button"
            className="exam-icon-btn"
            title={isFullscreen ? vi.exam.exitFullscreen : vi.exam.fullscreen}
            onClick={toggleFullscreen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {isFullscreen ? (
                <>
                  <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" />
                </>
              ) : (
                <>
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                </>
              )}
            </svg>
          </button>
          <span className="exam-answered-count">
            {vi.exam.answeredCount(answeredStats.answered, answeredStats.total)}
          </span>
          <div className="exam-zoom-controls">
            <button
              type="button"
              className="exam-zoom-btn"
              title={vi.exam.zoomOut}
              disabled={fontScaleIdx <= 0}
              onClick={() => setFontScaleIdx((i) => Math.max(0, i - 1))}
            >
              −
            </button>
            <button
              type="button"
              className="exam-zoom-btn"
              title={vi.exam.zoomIn}
              disabled={fontScaleIdx >= FONT_SCALES.length - 1}
              onClick={() => setFontScaleIdx((i) => Math.min(FONT_SCALES.length - 1, i + 1))}
            >
              +
            </button>
            <button
              type="button"
              className="exam-zoom-btn exam-zoom-btn--reset"
              title={vi.exam.zoomReset}
              onClick={() => setFontScaleIdx(1)}
            >
              ↕
            </button>
          </div>
        </div>
      </header>

      <AudioPlayer
        url={audioUrl}
        maxPlays={audioRules?.max_plays ?? 2}
        audioIndex={audioQuestionRange.index}
        questionFrom={audioQuestionRange.from}
        questionTo={audioQuestionRange.to}
      />

      <div className="exam-main">
        <ExamViewShell
          questions={questions}
          answers={answers}
          uiMode={uiMode}
          fontScale={FONT_SCALES[fontScaleIdx]}
          onViewModeChange={(mode) => setUiOverride(mode)}
          currentIdx={currentIdx}
          onCurrentIdxChange={setCurrentIdx}
          onChange={(id, a) => setAnswer(id, a)}
          onQuestionClick={(i) => studentApi.auditClick(`q-${i}`).catch(() => {})}
          subjectCode={subjectCode}
          partOrder={partOrder}
        />
      </div>

      <ExamQuestionPalette
        questions={questions}
        answers={answers}
        currentIdx={currentIdx}
        partOrder={partOrder}
        onSelect={(i) => {
          setCurrentIdx(i);
          scrollToQuestion(i);
          studentApi.auditClick(`q-${i}`).catch(() => {});
        }}
      />
    </div>
  );
}
