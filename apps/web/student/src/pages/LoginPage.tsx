import { useState, useEffect } from 'react';

import { useExamStore } from '../store';

import { studentApi } from '../api';

import { APP_AUTHOR, SCHOOL_NAME, vi, isProductionUi, CbtBrandLogo, ApiStatusBanner } from '@shared/index';



export default function LoginPage() {

  const [examAccount, setExamAccount] = useState('');

  const [pin, setPin] = useState('');

  const [examSessionId, setExamSessionId] = useState('');

  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [clientIp, setClientIp] = useState('—');

  const setAuth = useExamStore((s) => s.setAuth);
  const setExamSessionIdStore = useExamStore((s) => s.setExamSessionId);

  const production = isProductionUi();



  useEffect(() => {

    studentApi

      .roomContext()

      .then((ctx) => {

        setExamSessionId(ctx.examSessionId);

        setExamSessionIdStore(ctx.examSessionId);

      })

      .catch((err) => {
        setRoomError(err instanceof Error ? err.message : 'Không tải được cấu hình phòng thi');
      });



    if (!production) {

      fetch('/student/dev-credentials.json')

        .then((r) => (r.ok ? r.json() : null))

        .then((cred) => {

          if (!cred) return;

          if (cred.tnExamSessionId) {

            setExamSessionId(cred.tnExamSessionId);

            setExamSessionIdStore(cred.tnExamSessionId);

          }

          if (!examAccount && cred.examAccountFrom) setExamAccount(cred.examAccountFrom);

          else if (!examAccount && cred.sbdFrom) setExamAccount(cred.sbdFrom);

          if (!pin && cred.pin) setPin(cred.pin);

        })

        .catch(() => {});

    }



    fetch('/api/infra/health')

      .then((r) => r.json())

      .then((d) => {

        if (d?.clientIp) setClientIp(d.clientIp);

      })

      .catch(() => setClientIp(window.location.hostname));

  }, []);



  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    setError('');

    try {

      if (examSessionId) setExamSessionIdStore(examSessionId);

      const res = await studentApi.login(examAccount, pin, examSessionId || undefined);

      setAuth(res.token, res.sessionId, {

        hasPersonalSlots: res.hasPersonalSlots,

        subjectCode: res.subjectCode,

        sbd: res.sbd,

        examAccount: res.examAccount,

      });

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');

    } finally {

      setLoading(false);

    }

  };



  return (

    <div className="student-login">
      <ApiStatusBanner />

      {!production && (

        <div className="student-login__feature">

          <h1>TÍNH NĂNG 1. CỔNG ĐĂNG NHẬP BẢO MẬT</h1>

          <p>{vi.subtitle}</p>

        </div>

      )}

      <div className="student-login__window">

        <header className="student-login__topbar">

          <span>CBT — {SCHOOL_NAME.toUpperCase()}</span>

          <span>IP: {clientIp}</span>

        </header>

        <div className="student-login__body">

          <div className="student-login__card">

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>

              <CbtBrandLogo variant="login" size={88} showSchoolName logoUrl="/student/branding/logo.png" />

            </div>

            <h2>{vi.login.title}</h2>

            <p className="student-login__hint">{vi.login.accountHint}</p>
            {roomError && <p className="cbt-error-text" style={{ fontSize: '0.85rem' }}>{roomError}</p>}

            <form onSubmit={handleLogin}>

              <div className="cbt-form-group">

                <label className="cbt-label">{vi.login.examAccount}</label>

                <input

                  className="cbt-input"

                  value={examAccount}

                  onChange={(e) => setExamAccount(e.target.value)}

                  placeholder={vi.login.accountPlaceholder}

                  inputMode="numeric"

                  pattern="[0-9]{6}"

                  maxLength={12}

                  required

                  autoComplete="username"

                />

              </div>

              <div className="cbt-form-group">

                <label className="cbt-label">{vi.login.pin}</label>

                <input

                  className="cbt-input"

                  type="password"

                  value={pin}

                  onChange={(e) => setPin(e.target.value)}

                  inputMode="numeric"

                  pattern="[0-9]{8}"

                  maxLength={8}

                  required

                  autoComplete="current-password"

                />

                <p className="student-login__hint">{vi.login.pinHint}</p>

              </div>

              {error && <p className="cbt-error-text">{error}</p>}

              <button type="submit" className="cbt-btn cbt-btn-primary student-login__submit" disabled={loading}>

                {loading ? vi.login.loading : vi.login.submit}

              </button>

            </form>

          </div>

        </div>

        <footer className="student-login__footer">

          <span>
            © {APP_AUTHOR} · {production ? vi.footerPublic : `${SCHOOL_NAME} — ${vi.footerDoc}`}
          </span>

          {!production && <span>Trang 1/24</span>}

        </footer>

      </div>

    </div>

  );

}

