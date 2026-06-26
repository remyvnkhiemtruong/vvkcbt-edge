import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  CbtPageShell,
  CbtBrandLogo,
  vi,
  isProductionUi,
  getSubjectNameVi,
  ApiStatusBanner,
} from '@shared/index';
import { AuditTab } from './post-exam/AuditTab';
import { BackupTab } from './post-exam/BackupTab';
import { ReportTab } from './post-exam/ReportTab';
import { SystemTab } from './post-exam/SystemTab';
import { RoomScoreSheetTab } from './post-exam/RoomScoreSheetTab';
import { EndSubjectSessionPanel } from './post-exam/EndSubjectSessionPanel';
import { ScoreboardOverlay, readAutoScoreboardEnabled, type SubjectRoomCompleteData } from './post-exam/ScoreboardOverlay';
import { StudentDetailPanel, type GridItemExtended } from './post-exam/StudentDetailPanel';
import { ProctorStudentTable } from './monitor/ProctorStudentTable';
import { buildMonitorRows } from './monitor/proctor-monitor-utils';
import { useProctorSocket } from './hooks/useProctorSocket';
import { PreflightChecklist } from './prep/PreflightChecklist';
import {
  clearProctorToken,
  getProctorToken,
  handleProctorApiError,
  proctorFetch,
  proctorLogin,
  SESSION_EXPIRED_MSG,
  verifyProctorSession,
  isProctorTokenUsable,
} from './api';

type ProctorMode = 'prep' | 'monitor' | 'report' | 'roomsheet' | 'endsession' | 'audit' | 'backup' | 'system';

const ProctorActionType = {
  LOCK_EXAM: 'lock_exam',
  EXTEND_TIME: 'extend_time',
  FORCE_SUBMIT: 'force_submit',
  RESET_SESSION: 'reset_session',
} as const;

type GridItem = GridItemExtended;

interface RoomContext {
  examSessionId: string;
  roomName: string;
  capacity: number;
  schoolName: string;
}

const API = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'vnu_proctor_exam_session';

function ProctorLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await proctorLogin(username, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
  <>
    <ApiStatusBanner />
    <CbtPageShell headerTitle={vi.proctor.title} darkBody>
      <form className="proctor-login" onSubmit={handleSubmit}>
        <h2>Đăng nhập giám thị</h2>
        {error && <div className="proctor-login-error">{error}</div>}
        <label>
          Tên đăng nhập
          <input className="cbt-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Mật khẩu
          <input className="cbt-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="cbt-btn cbt-btn-primary" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="admin-hint" style={{ fontSize: '0.8rem', opacity: 0.85 }}>
          Mặc định dev: proctor / proctor123
        </p>
      </form>
      <style>{`
        .proctor-login { max-width: 360px; margin: 2rem auto; display: flex; flex-direction: column; gap: 0.75rem; color: #fff; }
        .proctor-login label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
        .proctor-login-error { background: #fef2f2; color: #b91c1c; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
      `}</style>
    </CbtPageShell>
  </>
  );
}

interface ImportResult {
  examSessionId: string;
  packageId: string;
  exportScope?: string;
  subjectCode?: string;
  importedSubjects?: string[];
  pendingSubjects?: string[];
  students: { created: number; updated: number };
  slots: { created: number; updated: number; removed: number };
  papers: { created: number; updated: number };
  media: { imported: number };
  errors: Array<{ message: string }>;
}

interface ImportStatusRow {
  code: string;
  nameVi: string;
  scheduledStart: string | null;
  hasPaper: boolean;
  hasCredentials: boolean;
}

function ProctorPrep({
  token,
  onReady,
  onSessionExpired,
}: {
  token: string;
  onReady: (examSessionId: string, subjectCodes?: string[]) => void;
  onSessionExpired?: () => void;
}) {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<{
    subjects: ImportStatusRow[];
    importedSubjects: string[];
    pendingSubjects?: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'info'; message: string } | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{
    passed: boolean;
    checklist: Array<{ item: string; ok: boolean; detail?: string }>;
  } | null>(null);
  const [packageStatus, setPackageStatus] = useState<{
    canImportNewPackage: boolean;
    needsImportConfirm: boolean;
    roomExportedAt: string | null;
    examSessionId: string | null;
  } | null>(null);

  useEffect(() => {
    proctorFetch('/proctor/packages/status', token)
      .then((res) => res.json())
      .then((data) =>
        setPackageStatus({
          canImportNewPackage: data.canImportNewPackage ?? true,
          needsImportConfirm: data.needsImportConfirm ?? false,
          roomExportedAt: data.roomExportedAt ?? null,
          examSessionId: data.examSessionId ?? null,
        }),
      )
      .catch(() => setPackageStatus(null));
  }, [token, importResult]);

  const prepError = (err: unknown) => {
    showToast('error', handleProctorApiError(err, onSessionExpired));
  };

  const fetchImportStatus = async (examSessionId?: string) => {
    const sid = examSessionId ?? importResult?.examSessionId ?? localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    try {
      const res = await proctorFetch('/proctor/sessions/current/import-status', token);
      const data = await res.json();
      setImportStatus({
        subjects: data.subjects ?? [],
        importedSubjects: data.importedSubjects ?? [],
        pendingSubjects: data.pendingSubjects ?? [],
      });
    } catch (err) {
      prepError(err);
    }
  };

  const showToast = (type: 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 6000);
  };

  const downloadTemplate = async () => {
    setBusy(true);
    try {
      const res = await proctorFetch('/proctor/packages/template', token);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'exam-package-mau.zip';
      a.click();
      showToast('info', 'Đã tải ZIP mẫu');
    } catch (err) {
      prepError(err);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      packageStatus?.needsImportConfirm &&
      !window.confirm(
        'Đã có ca thi trên máy — import khung giờ khác sẽ xóa dữ liệu ca hiện tại. Cùng khung giờ sẽ gộp thêm môn. Tiếp tục?',
      )
    ) {
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await proctorFetch('/proctor/packages/import', token, {
        method: 'POST',
        body: fd,
      });
      const result = (await res.json()) as ImportResult;
      setImportResult(result);
      localStorage.setItem(SESSION_KEY, result.examSessionId);
      await fetchImportStatus(result.examSessionId);
      onReady(result.examSessionId, result.importedSubjects ?? (result.subjectCode ? [result.subjectCode] : undefined));
      const statusRes = await proctorFetch('/proctor/packages/status', token);
      setPackageStatus(await statusRes.json());
    } catch (err) {
      prepError(err);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const resolveSubjectCodes = async (examSessionId: string): Promise<string[] | undefined> => {
    try {
      const res = await proctorFetch('/proctor/sessions/current/import-status', token);
      const data = await res.json();
      return data.importedSubjects ?? data.subjects?.map((s: { code: string }) => s.code);
    } catch {
      return undefined;
    }
  };

  const useExisting = async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const codes = await resolveSubjectCodes(stored);
      onReady(stored, codes);
      return;
    }
    try {
      const res = await proctorFetch('/proctor/packages/status', token);
      const data = await res.json();
      if (data.examSessionId) {
        localStorage.setItem(SESSION_KEY, data.examSessionId);
        const codes = await resolveSubjectCodes(data.examSessionId);
        onReady(data.examSessionId, codes);
        return;
      }
      showToast('error', 'Chưa có ca thi — import gói ZIP trước');
    } catch (err) {
      prepError(err);
    }
  };

  return (
    <div className="proctor-prep">
      {toast && (
        <div className={`proctor-toast proctor-toast--${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}
      <h2>Chuẩn bị kỳ thi</h2>
      <p className="admin-hint">
        Mỗi thí sinh chỉ thi <strong>một môn</strong>. Các môn <strong>cùng khung giờ</strong> có thể import nhiều USB
        (mỗi USB một môn) — hệ thống tự gộp vào một ca. Import khung giờ khác sẽ thay ca hiện tại (nên xuất gói phòng thi trước).
      </p>
      <div className="proctor-prep-actions">
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={downloadTemplate} disabled={busy}>
          Tải ZIP mẫu
        </button>
        <label className="cbt-btn cbt-btn-primary" style={{ cursor: 'pointer' }}>
          Import gói kỳ thi
          <input
            type="file"
            accept=".zip"
            hidden
            onChange={onImport}
            disabled={busy}
          />
        </label>
        <label className="cbt-btn cbt-btn-outline" style={{ cursor: 'pointer' }}>
          {vi.proctor.dryRun}
          <input
            type="file"
            accept=".zip"
            hidden
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const fd = new FormData();
                fd.append('file', file);
                const res = await proctorFetch('/proctor/packages/dry-run', token, {
                  method: 'POST',
                  body: fd,
                });
                setDryRunResult(await res.json());
              } catch (err) {
                prepError(err);
              } finally {
                setBusy(false);
                e.target.value = '';
              }
            }}
          />
        </label>
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={useExisting} disabled={busy}>
          Dùng ca đã import
        </button>
      </div>
      {dryRunResult && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ color: dryRunResult.passed ? '#86efac' : '#fca5a5' }}>
            {vi.proctor.dryRunResult(dryRunResult.passed)}
          </h3>
          <ul style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
            {dryRunResult.checklist.map((c) => (
              <li key={c.item} style={{ color: c.ok ? '#86efac' : '#fca5a5' }}>
                {c.ok ? '✓' : '✗'} {c.item}{c.detail ? ` — ${c.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {importStatus && importStatus.subjects.length > 0 && (
        <div className="proctor-import-checklist" style={{ marginTop: '1rem' }}>
          <h3>Ca thi hiện tại</h3>
          {importStatus.subjects.map((s) => (
            <p key={s.code} className="admin-hint">
              Môn: <strong>{s.nameVi}</strong>
              {' · '}
              Đề: {s.hasPaper ? '✓' : '○'}
              {' · '}
              Thí sinh: {s.hasCredentials ? '✓' : '○'}
            </p>
          ))}
          {importStatus.pendingSubjects && importStatus.pendingSubjects.length > 0 && (
            <p className="admin-hint" style={{ color: '#fde68a' }}>
              Chưa có đề: {importStatus.pendingSubjects.map((c) => getSubjectNameVi(c)).join(', ')}
            </p>
          )}
        </div>
      )}
      {importResult && (
        <div className="proctor-import-summary">
          <h3>Import thành công</h3>
          <p className="admin-hint">
            {vi.proctor.packageId(importResult.packageId)} · {vi.proctor.sessionId(importResult.examSessionId)}
          </p>
          {importResult.subjectCode && (
            <p className="admin-hint">
              Môn thi: <strong>{getSubjectNameVi(importResult.subjectCode)}</strong>
            </p>
          )}
          <p className="admin-hint">
            Thí sinh: +{importResult.students.created} / cập nhật {importResult.students.updated} · Slot:{' '}
            {importResult.slots.created} · Đề: +{importResult.papers.created} / cập nhật{' '}
            {importResult.papers.updated} · Media: {importResult.media.imported}
          </p>
          <p className="admin-hint" style={{ color: '#86efac' }}>
            Thí sinh đăng nhập bằng tài khoản 6 số + PIN trên phiếu đã in từ Composer.
          </p>
          <div className="proctor-prep-actions">
            <button
              type="button"
              className="cbt-btn cbt-btn-outline"
              disabled={busy}
              onClick={async () => {
                try {
                  const res = await proctorFetch(
                    `/proctor/sessions/${importResult.examSessionId}/dashboard`,
                    token,
                  );
                  const d = await res.json();
                  showToast(
                    'info',
                    `Tổng: ${d.totalStudents} · Đã nộp: ${d.submitted} · Đang thi: ${d.inExam} · Vi phạm: ${d.violations}`,
                  );
                } catch (err) {
                  prepError(err);
                }
              }}
            >
              Dashboard tổng hợp
            </button>
          </div>
        </div>
      )}
      <PreflightChecklist token={token} />
      <style>{`
        .proctor-prep { color: #fff; padding: 1rem 0; }
        .proctor-prep-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
        .proctor-toast { padding: 0.65rem 1rem; border-radius: 6px; margin-bottom: 0.75rem; font-size: 0.9rem; }
        .proctor-toast--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .proctor-toast--info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
      `}</style>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => isProctorTokenUsable(getProctorToken()));
  const [sessionChecking, setSessionChecking] = useState(() => isProctorTokenUsable(getProctorToken()));
  const [token, setToken] = useState(() => getProctorToken() || '');
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [examSessionId, setExamSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const [mode, setMode] = useState<ProctorMode>(() =>
    localStorage.getItem(SESSION_KEY) ? 'monitor' : 'prep',
  );
  const [roomName, setRoomName] = useState('Phòng máy số 1');
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [gridSearch, setGridSearch] = useState('');
  const [gridFilter, setGridFilter] = useState<
    'all' | 'active' | 'submitted' | 'offline' | 'violation' | 'help'
  >('all');
  const [sessionSubjectCodes, setSessionSubjectCodes] = useState<string[]>([]);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [monitorSubjectFilter, setMonitorSubjectFilter] = useState('');
  const [helpSbds, setHelpSbds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<GridItem | null>(null);
  const [scoreboardData, setScoreboardData] = useState<SubjectRoomCompleteData | null>(null);
  const [scoreboardToast, setScoreboardToast] = useState<string | null>(null);
  const production = isProductionUi();

  const handleSessionExpired = () => {
    clearProctorToken();
    setToken('');
    setAuthed(false);
    setSessionToast(SESSION_EXPIRED_MSG);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = getProctorToken();
      if (!isProctorTokenUsable(t)) {
        setAuthed(false);
        setSessionChecking(false);
        return;
      }
      if (!t) {
        setSessionChecking(false);
        return;
      }
      const ok = await verifyProctorSession(t);
      if (!cancelled) {
        setAuthed(ok);
        if (ok) setToken(t);
        else setToken('');
        setSessionChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      setExamSessionId(stored);
      setMode('monitor');
      return;
    }

    fetch(`${API}/api/edge/room-context`)
      .then((r) => r.json())
      .then((ctx: RoomContext) => {
        if (!localStorage.getItem(SESSION_KEY)) {
          setExamSessionId(ctx.examSessionId);
        }
        setRoomName(ctx.roomName);
      })
      .catch(() => {});

    if (!production) {
      fetch('/proctor/dev-credentials.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((cred) => {
          if (cred?.tnExamSessionId && !localStorage.getItem(SESSION_KEY)) {
            setExamSessionId(cred.tnExamSessionId);
          }
        })
        .catch(() => {});
    }
  }, [authed, production]);

  useEffect(() => {
    if (!authed || !examSessionId || !token) return;

    proctorFetch(`/proctor/sessions/current/import-status`, token)
      .then((r) => r.json())
      .then((d: { importedSubjects?: string[]; subjects?: Array<{ code: string }> }) => {
        const codes = d.importedSubjects ?? d.subjects?.map((s) => s.code) ?? [];
        setSessionSubjectCodes(codes);
        setSelectedSubjectCode((prev) => (prev && codes.includes(prev) ? prev : codes[0] ?? ''));
      })
      .catch((err) => {
        if (err instanceof Error && err.message === SESSION_EXPIRED_MSG) handleSessionExpired();
      });
  }, [examSessionId, authed, token]);

  useProctorSocket({
    token,
    examSessionId,
    monitorSubject: monitorSubjectFilter || undefined,
    onConnectedChange: setConnected,
    onSessionExpired: handleSessionExpired,
    onGridUpdate: setGrid,
    onScoreUpdate: (data) => {
      setGrid((prev) =>
        prev.map((g) =>
          g.sbd === data.sbd
            ? { ...g, scoreTotal: data.scoreTotal, partScores: data.partScores, submitted: true, manualOverride: true }
            : g,
        ),
      );
      setSelected((sel) =>
        sel && sel.sbd === data.sbd
          ? { ...sel, scoreTotal: data.scoreTotal, partScores: data.partScores, submitted: true, manualOverride: true }
          : sel,
      );
    },
    onSubjectRoomComplete: (data) => {
      if (readAutoScoreboardEnabled()) {
        setScoreboardData(data);
      }
      setScoreboardToast(`Đã nộp hết — ${data.subjectNameVi} (${data.stats.completed}/${data.stats.total})`);
      window.setTimeout(() => setScoreboardToast(null), 8000);
      try {
        const beep = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6Wj4uGgH1wZ2VhX1lRT0pIRkE/PDo4NjQyMC8sKyknJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAA==',
        );
        beep.volume = 0.5;
        void beep.play();
      } catch {
        /* optional */
      }
    },
    onCheatingAlert: (data) => {
      setAlerts((a) =>
        [`CẢNH BÁO: SBD ${data.sbd} — ${vi.proctor.violation} (${data.violations} lần)`, ...a].slice(0, 20),
      );
    },
    onHelpAlert: (data) => {
      setHelpSbds((prev) => new Set(prev).add(data.sbd));
      setAlerts((a) =>
        [`HỖ TRỢ: SBD ${data.sbd} — ${data.reason ?? 'Yêu cầu giám thị'}`, ...a].slice(0, 20),
      );
    },
  });

  const handleLogout = () => {
    clearProctorToken();
    setToken('');
    setAuthed(false);
    setSessionToast(null);
  };

  const action = async (studentSessionId: string, act: string, payload?: Record<string, unknown>) => {
    try {
      await proctorFetch('/proctor/action', token, {
        method: 'POST',
        body: JSON.stringify({ examSessionId, studentSessionId, action: act, payload }),
      });
    } catch (err) {
      if (err instanceof Error && err.message === SESSION_EXPIRED_MSG) handleSessionExpired();
      else throw err;
    }
  };

  const exportPdf = (studentSessionId: string) => {
    window.open(`${API}/api/post-exam/pdf/${studentSessionId}`, '_blank');
  };

  if (sessionChecking) {
    return (
      <CbtPageShell headerTitle={vi.proctor.title} darkBody wide>
        <p className="admin-hint" style={{ padding: '2rem', color: '#e2e8f0' }}>
          Đang xác minh phiên đăng nhập…
        </p>
      </CbtPageShell>
    );
  }

  if (!authed) {
    return (
      <>
        {sessionToast && (
          <div
            style={{
              position: 'fixed',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              fontSize: '0.9rem',
            }}
          >
            {sessionToast}
          </div>
        )}
        <ProctorLogin
          onLogin={() => {
            const t = getProctorToken();
            if (t) {
              setToken(t);
              setAuthed(true);
              setSessionToast(null);
            }
          }}
        />
      </>
    );
  }

  if (mode === 'prep' || !examSessionId) {
    return (
      <CbtPageShell headerTitle={vi.proctor.title} darkBody wide>
        <div className="proctor-toolbar">
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
        <ProctorPrep
          token={token}
          onReady={(id, subjectCodes) => {
            setExamSessionId(id);
            if (subjectCodes?.length) {
              setSessionSubjectCodes(subjectCodes);
              setSelectedSubjectCode(subjectCodes[0]);
            }
            setMode('monitor');
          }}
          onSessionExpired={handleSessionExpired}
        />
      </CbtPageShell>
    );
  }

  const modeNav = (m: ProctorMode, label: string) => (
    <button
      key={m}
      type="button"
      className={`cbt-btn ${mode === m ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
      onClick={() => setMode(m)}
    >
      {label}
    </button>
  );

  if (mode !== 'monitor') {
    return (
      <CbtPageShell headerTitle={vi.proctor.title} darkBody wide>
        <div className="proctor-toolbar proctor-mode-nav">
          {modeNav('monitor', 'Giám sát')}
          {modeNav('report', 'Báo cáo')}
          {modeNav('roomsheet', 'Biên bản phòng')}
          {modeNav('endsession', 'Kết thúc ca thi')}
          {modeNav('audit', 'Nhật ký')}
          {modeNav('backup', 'Sao lưu')}
          {modeNav('system', 'Hệ thống')}
          {modeNav('prep', 'Import gói')}
          <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
        {mode === 'report' && <ReportTab token={token} examSessionId={examSessionId} />}
        {mode === 'roomsheet' && (
          <RoomScoreSheetTab
            token={token}
            examSessionId={examSessionId}
            subjectCodes={sessionSubjectCodes}
            subjectCode={selectedSubjectCode}
            onSubjectCodeChange={setSelectedSubjectCode}
            defaultRoom={roomName}
          />
        )}
        {mode === 'endsession' && (
          <EndSubjectSessionPanel
            token={token}
            examSessionId={examSessionId}
            subjectCodes={sessionSubjectCodes}
            subjectCode={selectedSubjectCode}
            onSubjectCodeChange={setSelectedSubjectCode}
            defaultRoom={roomName}
            onComplete={(data) => setScoreboardData(data)}
          />
        )}
        {mode === 'audit' && <AuditTab token={token} examSessionId={examSessionId} />}
        {mode === 'backup' && <BackupTab token={token} />}
        {mode === 'system' && <SystemTab token={token} />}
        <style>{`
          .proctor-mode-nav { flex-wrap: wrap; justify-content: flex-start; gap: 0.35rem; margin-bottom: 1rem; }
        `}</style>
      </CbtPageShell>
    );
  }

  const matchesGrid = (item: GridItem) => {
    if (monitorSubjectFilter && item.subjectCode !== monitorSubjectFilter) return false;
    const q = gridSearch.trim().toLowerCase();
    if (q) {
      const account = (item.examAccount ?? '').toLowerCase();
      const sbd = (item.sbd ?? '').toLowerCase();
      const last4 = account.slice(-4);
      if (!sbd.includes(q) && !account.includes(q) && last4 !== q) return false;
    }
    if (gridFilter === 'help') return helpSbds.has(item.sbd);
    if (gridFilter === 'submitted') return item.submitted;
    if (gridFilter === 'violation') return item.violations > 0;
    if (gridFilter === 'offline') return item.status === 'OFFLINE' || item.status === 'offline';
    if (gridFilter === 'active') return !!item.sbd && !item.submitted && item.status === 'ACTIVE';
    return true;
  };

  const monitorRows = buildMonitorRows(grid, matchesGrid);

  return (
    <CbtPageShell
      featureTitle={production ? undefined : 'TÍNH NĂNG 10. BẢNG ĐIỀU KHIỂN GIÁM THỊ'}
      headerTitle={vi.proctor.title}
      headerLeft={<CbtBrandLogo size={40} logoUrl="/proctor/branding/logo.png" />}
      headerRight={`${roomName} | Thí sinh: ${grid.length}`}
      pageNumber={production ? undefined : 10}
      darkBody
      wide
    >
      <div className="proctor-toolbar proctor-mode-nav">
        <span className={`proctor-ws ${connected ? 'on' : 'off'}`}>
          {connected ? '● Kết nối realtime' : '○ Mất kết nối WS'}
        </span>
        {modeNav('monitor', 'Giám sát')}
        {modeNav('report', 'Báo cáo')}
        {modeNav('roomsheet', 'Biên bản phòng')}
        {modeNav('endsession', 'Kết thúc ca thi')}
        {modeNav('audit', 'Nhật ký')}
        {modeNav('backup', 'Sao lưu')}
        {modeNav('system', 'Hệ thống')}
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setMode('prep')}>
          Import gói
        </button>
        {scoreboardData && (
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setScoreboardData(scoreboardData)}>
            Mở lại bảng điểm
          </button>
        )}
        <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>

      {scoreboardToast && (
        <div className="proctor-alert proctor-alert--success">
          {scoreboardToast}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="proctor-alerts">
          {alerts.map((a, i) => (
            <div key={i} className="proctor-alert">
              {a}
            </div>
          ))}
        </div>
      )}

      <div className="proctor-monitor-main">
      <div className="proctor-grid-tools">
        <input
          className="cbt-input proctor-input"
          placeholder="Tìm SBD hoặc 4 số cuối TK..."
          value={gridSearch}
          onChange={(e) => setGridSearch(e.target.value)}
        />
        <select
          className="cbt-input proctor-input proctor-input--filter"
          value={monitorSubjectFilter}
          onChange={(e) => setMonitorSubjectFilter(e.target.value)}
          title="Lọc theo môn"
        >
          <option value="">Tất cả môn</option>
          {sessionSubjectCodes.map((code) => (
            <option key={code} value={code}>
              {getSubjectNameVi(code)}
            </option>
          ))}
        </select>
        <select
          className="cbt-input proctor-input proctor-input--filter"
          value={gridFilter}
          onChange={(e) => setGridFilter(e.target.value as typeof gridFilter)}
        >
          <option value="all">{vi.proctor.filterAll}</option>
          <option value="active">{vi.proctor.filterActive}</option>
          <option value="submitted">{vi.proctor.filterSubmitted}</option>
          <option value="violation">{vi.proctor.filterViolation}</option>
          <option value="offline">{vi.proctor.filterOffline}</option>
          <option value="help">{vi.proctor.filterHelp}</option>
        </select>
      </div>

      <ProctorStudentTable
        rows={monitorRows}
        helpSbds={helpSbds}
        onSelect={setSelected}
        onAction={(id, act, payload) => void action(id, act, payload)}
      />

      {selected && selected.sbd && (
        <>
          <StudentDetailPanel
            item={selected}
            onClose={() => setSelected(null)}
          />
          <div className="proctor-action-panel">
            <div className="proctor-actions">
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => action(selected.id, ProctorActionType.LOCK_EXAM)}>
                Khóa bài
              </button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => action(selected.id, ProctorActionType.EXTEND_TIME, { minutes: 15 })}>
                Gia hạn 15 phút
              </button>
              <button type="button" className="cbt-btn cbt-btn-primary" onClick={() => action(selected.id, ProctorActionType.FORCE_SUBMIT)}>
                Nộp bài
              </button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => action(selected.id, ProctorActionType.RESET_SESSION)}>
                Reset phiên
              </button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => exportPdf(selected.id)}>
                Xuất PDF
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {scoreboardData && (
        <ScoreboardOverlay data={scoreboardData} token={token} onClose={() => setScoreboardData(null)} />
      )}
    </CbtPageShell>
  );
}
