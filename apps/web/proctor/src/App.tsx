import { FormEvent, useEffect, useState } from 'react';
import {
  createSocket,
  CbtPageShell,
  CbtMachineCard,
  CbtBrandLogo,
  mapProctorStatus,
  vi,
  isProductionUi,
} from '@shared/index';
import { GradingTab } from './post-exam/GradingTab';
import { AuditTab } from './post-exam/AuditTab';
import { BackupTab } from './post-exam/BackupTab';
import { ReportTab } from './post-exam/ReportTab';
import { SystemTab } from './post-exam/SystemTab';
import { RoomScoreSheetTab } from './post-exam/RoomScoreSheetTab';
import { StudentDetailPanel, type GridItemExtended } from './post-exam/StudentDetailPanel';

type ProctorMode = 'prep' | 'monitor' | 'schedule' | 'grading' | 'report' | 'roomsheet' | 'audit' | 'backup' | 'system';

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
const TOKEN_KEY = 'vnu_proctor_token';
const SESSION_KEY = 'vnu_proctor_exam_session';

function getProctorToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setProctorToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearProctorToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

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
      const res = await fetch(`${API}/api/auth/proctor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setProctorToken(data.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
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
      </form>
      <style>{`
        .proctor-login { max-width: 360px; margin: 2rem auto; display: flex; flex-direction: column; gap: 0.75rem; color: #fff; }
        .proctor-login label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }
        .proctor-login-error { background: #fef2f2; color: #b91c1c; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
      `}</style>
    </CbtPageShell>
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
}: {
  token: string;
  onReady: (examSessionId: string) => void;
}) {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<{
    subjects: ImportStatusRow[];
    importedSubjects: string[];
    pendingSubjects: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'info'; message: string } | null>(null);
  const [dryRunResult, setDryRunResult] = useState<{
    passed: boolean;
    checklist: Array<{ item: string; ok: boolean; detail?: string }>;
  } | null>(null);

  const authHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
  });

  const fetchImportStatus = async (examSessionId?: string) => {
    const sid = examSessionId ?? importResult?.examSessionId ?? localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    const res = await fetch(`${API}/api/proctor/sessions/current/import-status`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setImportStatus({
        subjects: data.subjects ?? [],
        importedSubjects: data.importedSubjects ?? [],
        pendingSubjects: data.pendingSubjects ?? [],
      });
    }
  };

  const showToast = (type: 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 6000);
  };

  const downloadTemplate = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/proctor/packages/template`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'exam-package-mau.zip';
      a.click();
      showToast('info', 'Đã tải ZIP mẫu');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không tải được ZIP mẫu');
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/api/proctor/packages/import`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as ImportResult;
      setImportResult(result);
      localStorage.setItem(SESSION_KEY, result.examSessionId);
      await fetchImportStatus(result.examSessionId);
      onReady(result.examSessionId);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const useExisting = async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      onReady(stored);
      return;
    }
    const res = await fetch(`${API}/api/proctor/packages/status`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.examSessionId) {
        localStorage.setItem(SESSION_KEY, data.examSessionId);
        onReady(data.examSessionId);
        return;
      }
    }
    showToast('error', 'Chưa có ca thi — import gói ZIP trước');
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
        Mỗi khung giờ chỉ cắm <strong>một USB</strong> — một môn — import rồi rút USB. Cùng packageId gộp thành một ca.
      </p>
      <div className="proctor-prep-actions">
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={downloadTemplate} disabled={busy}>
          Tải ZIP mẫu
        </button>
        <label className="cbt-btn cbt-btn-primary" style={{ cursor: 'pointer' }}>
          Import gói kỳ thi
          <input type="file" accept=".zip" hidden onChange={onImport} disabled={busy} />
        </label>
        <label className="cbt-btn cbt-btn-outline" style={{ cursor: 'pointer' }}>
          Dry-run (kiểm tra ZIP)
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
                const res = await fetch(`${API}/api/proctor/packages/dry-run`, {
                  method: 'POST',
                  headers: authHeaders(),
                  body: fd,
                });
                if (!res.ok) throw new Error(await res.text());
                setDryRunResult(await res.json());
              } catch (err) {
                showToast('error', err instanceof Error ? err.message : 'Dry-run thất bại');
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
            Dry-run: {dryRunResult.passed ? 'PASS' : 'FAIL'}
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
          <h3>Môn đã import / chưa import</h3>
          <table className="cbt-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Môn</th>
                <th>Đề</th>
                <th>Thí sinh</th>
                <th>Giờ mở</th>
              </tr>
            </thead>
            <tbody>
              {importStatus.subjects.map((s) => (
                <tr key={s.code}>
                  <td>{s.nameVi}</td>
                  <td style={{ color: s.hasPaper ? '#86efac' : '#fca5a5' }}>{s.hasPaper ? '✓' : '○'}</td>
                  <td style={{ color: s.hasCredentials ? '#86efac' : '#fca5a5' }}>{s.hasCredentials ? '✓' : '○'}</td>
                  <td>{s.scheduledStart ? new Date(s.scheduledStart).toLocaleString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {importStatus.pendingSubjects.length > 0 && (
            <p className="admin-hint">Chưa import: {importStatus.pendingSubjects.join(', ')}</p>
          )}
        </div>
      )}
      {importResult && (
        <div className="proctor-import-summary">
          <h3>Import thành công</h3>
          <p className="admin-hint">Package: {importResult.packageId} · Ca: {importResult.examSessionId}</p>
          {importResult.subjectCode && (
            <p className="admin-hint">
              ZIP môn: <strong>{importResult.subjectCode}</strong>
              {importResult.exportScope === 'single_subject' ? ' (niêm phong từng môn)' : ''}
            </p>
          )}
          {importResult.pendingSubjects && importResult.pendingSubjects.length > 0 && (
            <p className="admin-hint" style={{ color: '#fcd34d' }}>
              Còn thiếu môn: {importResult.pendingSubjects.join(', ')}
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
                const res = await fetch(`${API}/api/proctor/sessions/${importResult.examSessionId}/dashboard`, {
                  headers: authHeaders(),
                });
                if (res.ok) {
                  const d = await res.json();
                  showToast(
                    'info',
                    `Tổng: ${d.totalStudents} · Đã nộp: ${d.submitted} · Đang thi: ${d.inExam} · Vi phạm: ${d.violations}`,
                  );
                }
              }}
            >
              Dashboard tổng hợp
            </button>
          </div>
        </div>
      )}
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
  const [authed, setAuthed] = useState(() => !!getProctorToken());
  const [token, setToken] = useState(() => getProctorToken() || '');
  const [examSessionId, setExamSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || '');
  const [mode, setMode] = useState<ProctorMode>(() =>
    localStorage.getItem(SESSION_KEY) ? 'monitor' : 'prep',
  );
  const [roomName, setRoomName] = useState('Phòng máy số 1');
  const [capacity, setCapacity] = useState(30);
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [gridSearch, setGridSearch] = useState('');
  const [gridFilter, setGridFilter] = useState<
    'all' | 'active' | 'submitted' | 'offline' | 'violation' | 'help'
  >('all');
  const [monitorSubject, setMonitorSubject] = useState('');
  const [helpSbds, setHelpSbds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<GridItem | null>(null);
  const [serverTime, setServerTime] = useState('');
  const [subjectSchedule, setSubjectSchedule] = useState<
    Array<{ subjectCode: string; scheduledStart: string; scheduledEnd: string; status: string; slotId: string }>
  >([]);
  const production = isProductionUi();

  const authHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

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
        setCapacity(ctx.capacity);
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

    const socket = createSocket('/proctoring', token);
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_proctor', { examSessionId });
    });
    socket.on('grid_update', (data: GridItem[]) => setGrid(data));
    socket.on(
      'score_update',
      (data: { sbd: string; scoreTotal?: number; partScores?: GridItem['partScores'] }) => {
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
    );
    socket.on('cheating_alert', (data: { sbd: string; violations: number }) => {
      setAlerts((a) =>
        [`CẢNH BÁO: SBD ${data.sbd} — ${vi.proctor.violation} (${data.violations} lần)`, ...a].slice(0, 20),
      );
      try {
        const beep = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6Wj4uGgH1wZ2VhX1lRT0pIRkE/PDo4NjQyMC8sKyknJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAA==',
        );
        beep.volume = 0.6;
        void beep.play();
      } catch {
        /* audio optional */
      }
    });
    socket.on('help_alert', (data: { sbd: string; reason?: string }) => {
      setHelpSbds((prev) => new Set(prev).add(data.sbd));
      setAlerts((a) =>
        [`HỖ TRỢ: SBD ${data.sbd} — ${data.reason ?? 'Yêu cầu giám thị'}`, ...a].slice(0, 20),
      );
      try {
        const beep = new Audio(
          'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6Wj4uGgH1wZ2VhX1lRT0pIRkE/PDo4NjQyMC8sKyknJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAA==',
        );
        beep.volume = 0.4;
        void beep.play();
      } catch {
        /* audio optional */
      }
    });
    socket.on('disconnect', () => setConnected(false));

    const gridQs = monitorSubject ? `?subjectCode=${encodeURIComponent(monitorSubject)}` : '';
    fetch(`${API}/api/proctor/grid/${examSessionId}${gridQs}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setGrid)
      .catch(console.error);

    const loadSchedule = () => {
      fetch(`${API}/api/proctor/sessions/${examSessionId}/subject-schedule`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          setServerTime(d.serverTime ?? '');
          setSubjectSchedule(d.subjects ?? []);
        })
        .catch(() => {});
    };
    loadSchedule();
    const schedIv = setInterval(loadSchedule, 15000);

    return () => {
      socket.disconnect();
      clearInterval(schedIv);
    };
  }, [examSessionId, authed, token, monitorSubject]);

  const handleLogout = () => {
    clearProctorToken();
    setToken('');
    setAuthed(false);
  };

  const action = async (studentSessionId: string, act: string, payload?: Record<string, unknown>) => {
    await fetch(`${API}/api/proctor/action`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ examSessionId, studentSessionId, action: act, payload }),
    });
  };

  const exportPdf = (studentSessionId: string) => {
    window.open(`${API}/api/post-exam/pdf/${studentSessionId}`, '_blank');
  };

  if (!authed) {
    return (
      <ProctorLogin
        onLogin={() => {
          const t = getProctorToken();
          if (t) {
            setToken(t);
            setAuthed(true);
          }
        }}
      />
    );
  }

  if (mode === 'prep' || !examSessionId) {
    return (
      <CbtPageShell headerTitle={vi.proctor.title} darkBody>
        <div className="proctor-toolbar">
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
        <ProctorPrep
          token={token}
          onReady={(id) => {
            setExamSessionId(id);
            setMode('monitor');
          }}
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

  if (mode !== 'monitor' && mode !== 'schedule') {
    return (
      <CbtPageShell headerTitle={vi.proctor.title} darkBody>
        <div className="proctor-toolbar proctor-mode-nav">
          {modeNav('monitor', 'Giám sát')}
          {modeNav('schedule', 'Lịch môn')}
          {modeNav('grading', 'Chấm bài')}
          {modeNav('report', 'Báo cáo')}
          {modeNav('roomsheet', 'Biên bản phòng')}
          {modeNav('audit', 'Nhật ký')}
          {modeNav('backup', 'Sao lưu')}
          {modeNav('system', 'Hệ thống')}
          {modeNav('prep', 'Import gói')}
          <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
        {mode === 'grading' && <GradingTab token={token} examSessionId={examSessionId} />}
        {mode === 'report' && <ReportTab token={token} examSessionId={examSessionId} />}
        {mode === 'roomsheet' && (
          <RoomScoreSheetTab token={token} examSessionId={examSessionId} defaultRoom={roomName} />
        )}
        {mode === 'audit' && <AuditTab token={token} examSessionId={examSessionId} />}
        {mode === 'backup' && <BackupTab token={token} />}
        {mode === 'system' && <SystemTab token={token} />}
        <style>{`
          .proctor-mode-nav { flex-wrap: wrap; justify-content: flex-start; gap: 0.35rem; margin-bottom: 1rem; }
          .proctor-tab-panel { color: #fff; padding: 0.5rem 0; }
          .proctor-tab-panel h3 { margin-top: 0; }
        `}</style>
      </CbtPageShell>
    );
  }

  if (mode === 'schedule') {
    const SUBJECT_VI: Record<string, string> = {
      MATH: 'Toán',
      LITERATURE: 'Ngữ văn',
      ENGLISH: 'Tiếng Anh',
      PHYSICS: 'Vật lý',
      CHEMISTRY: 'Hóa học',
      BIOLOGY: 'Sinh học',
      HISTORY: 'Lịch sử',
      GEOGRAPHY: 'Địa lý',
      CIVIC_EDU: 'GDKT&PL',
      TECHNOLOGY: 'Công nghệ',
      INFORMATICS: 'Tin học',
    };
    return (
      <CbtPageShell
        headerTitle={vi.proctor.title}
        headerLeft={<CbtBrandLogo size={40} logoUrl="/proctor/branding/logo.png" />}
        darkBody
      >
        <div className="proctor-toolbar proctor-mode-nav">
          {modeNav('monitor', 'Giám sát')}
          {modeNav('schedule', 'Lịch môn')}
          {modeNav('grading', 'Chấm bài')}
          {modeNav('report', 'Báo cáo')}
          {modeNav('roomsheet', 'Biên bản phòng')}
          {modeNav('audit', 'Nhật ký')}
          {modeNav('backup', 'Sao lưu')}
          {modeNav('system', 'Hệ thống')}
          <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
        <div style={{ color: '#fff', marginBottom: '1rem' }}>
          <strong>Giờ máy chủ:</strong>{' '}
          {serverTime ? new Date(serverTime).toLocaleString('vi-VN') : '—'}
        </div>
        <table className="cbt-table" style={{ color: '#fff' }}>
          <thead>
            <tr>
              <th>Môn</th>
              <th>Giờ mở</th>
              <th>Giờ kết thúc</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subjectSchedule.map((row) => {
              const canOpen =
                row.status === 'scheduled' && serverTime && new Date(serverTime) >= new Date(row.scheduledStart);
              const dueSoon =
                row.status === 'scheduled' && serverTime && new Date(serverTime) >= new Date(row.scheduledStart);
              return (
                <tr key={row.subjectCode} style={dueSoon ? { background: 'rgba(251, 191, 36, 0.15)' } : undefined}>
                  <td>{SUBJECT_VI[row.subjectCode] ?? row.subjectCode}</td>
                  <td>{new Date(row.scheduledStart).toLocaleString('vi-VN')}</td>
                  <td>{new Date(row.scheduledEnd).toLocaleString('vi-VN')}</td>
                  <td title="release_mode: proctor_at_time — giám thị mở đề thủ công">
                    {row.status}
                    {dueSoon && row.status !== 'open' ? ' ⚠ đến giờ' : ''}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cbt-btn cbt-btn-primary"
                      disabled={!canOpen}
                      onClick={async () => {
                        await fetch(`${API}/api/proctor/slots/${row.slotId}/open-early`, {
                          method: 'POST',
                          headers: authHeaders(),
                        });
                        setSubjectSchedule((prev) =>
                          prev.map((s) =>
                            s.subjectCode === row.subjectCode ? { ...s, status: 'open' } : s,
                          ),
                        );
                      }}
                    >
                      Mở đề
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CbtPageShell>
    );
  }

  const displayGrid: GridItem[] = [];
  const matchesGrid = (item: GridItem) => {
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

  for (let i = 1; i <= capacity; i++) {
    const item = grid[i - 1];
    if (item) {
      if (matchesGrid(item)) displayGrid.push(item);
    } else if (gridFilter === 'all' && !gridSearch.trim()) {
      displayGrid.push({
        id: `empty-${i}`,
        sbd: '',
        status: 'NOT_LOGGED_IN',
        violations: 0,
        locked: false,
        submitted: false,
      });
    }
  }

  return (
    <CbtPageShell
      featureTitle={production ? undefined : 'TÍNH NĂNG 10. BẢNG ĐIỀU KHIỂN GIÁM THỊ'}
      headerTitle={vi.proctor.title}
      headerLeft={<CbtBrandLogo size={40} logoUrl="/proctor/branding/logo.png" />}
      headerRight={`${roomName} | Sĩ số: ${capacity}`}
      pageNumber={production ? undefined : 10}
      darkBody
    >
      <div className="proctor-toolbar proctor-mode-nav">
        <span className={`proctor-ws ${connected ? 'on' : 'off'}`}>
          {connected ? '● Kết nối realtime' : '○ Mất kết nối WS'}
        </span>
        {modeNav('monitor', 'Giám sát')}
        {modeNav('schedule', 'Lịch môn')}
        {modeNav('grading', 'Chấm bài')}
        {modeNav('report', 'Báo cáo')}
        {modeNav('roomsheet', 'Biên bản phòng')}
        {modeNav('audit', 'Nhật ký')}
        {modeNav('backup', 'Sao lưu')}
        {modeNav('system', 'Hệ thống')}
        <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setMode('prep')}>
          Import gói
        </button>
        <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={handleLogout}>
          Đăng xuất
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="proctor-alerts">
          {alerts.map((a, i) => (
            <div key={i} className="proctor-alert">
              {a}
            </div>
          ))}
        </div>
      )}

      <div className="proctor-grid-tools">
        <input
          className="cbt-input"
          placeholder="Tìm SBD hoặc 4 số cuối TK..."
          value={gridSearch}
          onChange={(e) => setGridSearch(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <select
          className="cbt-input"
          value={monitorSubject}
          onChange={(e) => setMonitorSubject(e.target.value)}
          style={{ maxWidth: 140 }}
        >
          <option value="">Tất cả môn</option>
          {subjectSchedule.map((s) => (
            <option key={s.subjectCode} value={s.subjectCode}>
              {s.subjectCode}
            </option>
          ))}
        </select>
        <select
          className="cbt-input"
          value={gridFilter}
          onChange={(e) => setGridFilter(e.target.value as typeof gridFilter)}
          style={{ maxWidth: 160 }}
        >
          <option value="all">Tất cả</option>
          <option value="active">Đang thi</option>
          <option value="submitted">Đã nộp</option>
          <option value="violation">Vi phạm</option>
          <option value="offline">Offline</option>
          <option value="help">Gọi giám thị</option>
        </select>
      </div>

      <div className="proctor-grid">
        {displayGrid.map((item, idx) => {
          const { machineStatus, label } = mapProctorStatus(item.status, item.violations);
          const pct =
            item.questionCount && item.questionCount > 0 && item.answeredCount != null
              ? Math.round((item.answeredCount / item.questionCount) * 100)
              : null;
          const helpFlag = helpSbds.has(item.sbd);
          const cardLabel = item.sbd
            ? `SBD ${item.sbd}${item.submitted && item.scoreTotal != null ? ` · ${item.scoreTotal}đ` : ''}${pct != null && !item.submitted ? ` · ${pct}%` : ''}${item.violations ? ` · ${item.violations} VP` : ''}${helpFlag ? ' · 🆘' : ''}`
            : label;
          return (
            <CbtMachineCard
              key={item.id}
              machineNo={idx + 1}
              status={machineStatus}
              label={cardLabel}
              onClick={() => item.sbd && setSelected(item)}
            />
          );
        })}
      </div>

      {selected && selected.sbd && (
        <>
          <StudentDetailPanel
            item={selected}
            token={token}
            onClose={() => setSelected(null)}
            onScoreSaved={(id, scoreTotal, partScores) => {
              setGrid((prev) =>
                prev.map((g) => (g.id === id ? { ...g, scoreTotal, partScores, manualOverride: true } : g)),
              );
              setSelected((sel) =>
                sel && sel.id === id ? { ...sel, scoreTotal, partScores, manualOverride: true } : sel,
              );
            }}
          />
          <div className="proctor-action-panel" style={{ marginTop: '0.75rem' }}>
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

      <style>{`
        .proctor-toolbar { display: flex; justify-content: flex-end; margin-bottom: 1rem; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .proctor-mode-nav { justify-content: flex-start; }
        .proctor-ws.on { color: #16a34a; }
        .proctor-ws.off { color: #94a3b8; }
        .proctor-alerts { margin-bottom: 1rem; }
        .proctor-grid-tools { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .proctor-alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.35rem; font-size: 0.85rem; }
        .proctor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.75rem; }
        .proctor-action-panel { margin-top: 1.5rem; padding: 1rem; background: #1e293b; border-radius: 8px; color: #fff; }
        .proctor-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
      `}</style>
    </CbtPageShell>
  );
}
