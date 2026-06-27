import { useEffect, useState } from 'react';
import { CbtBrandLogo, vi, isProductionUi, translateApiError } from '@shared/index';
import { studentApi } from '../api';
import { useExamStore } from '../store';

interface StudentProfile {
  fullName: string;
  sbd: string;
  examAccount: string | null;
  subjectName: string;
  className: string;
  comboCode: string;
  subjectGroup: string;
  labRoom: string;
  sessionName: string;
  schoolName: string;
}

interface Props {
  onConfirmed: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="confirm-info__row">
      <dt className="confirm-info__label">{label}</dt>
      <dd className="confirm-info__value">{value}</dd>
    </div>
  );
}

export default function ConfirmInfoPage({ onConfirmed }: Props) {
  const logout = useExamStore((s) => s.logout);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const production = isProductionUi();

  useEffect(() => {
    let cancelled = false;
    studentApi
      .getProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data as StudentProfile);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? translateApiError(err.message) : 'Không tải được thông tin');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`confirm-info-page${!production ? ' confirm-info-page--spec' : ''}`}>
      {!production && (
        <div className="confirm-info-page__feature">
          <h1>XÁC NHẬN THÔNG TIN THÍ SINH</h1>
          <p>{vi.subtitle}</p>
        </div>
      )}

      <div className="confirm-info-page__window">
        <div className="confirm-info-page__topbar">
          <CbtBrandLogo variant="header" size={32} showSchoolName />
          <span className="confirm-info-page__topbar-title">{vi.confirmInfo.title}</span>
        </div>

        <div className="confirm-info-page__body">
          <p className="confirm-info-page__lead">{vi.confirmInfo.lead}</p>

          {loading && (
            <div className="confirm-info-page__loading" aria-live="polite">
              <span className="rules-page__spinner" aria-hidden />
              <span>{vi.confirmInfo.loading}</span>
            </div>
          )}

          {error && <p className="confirm-info-page__error">{error}</p>}

          {profile && !loading && (
            <dl className="confirm-info__table">
              <InfoRow label={vi.confirmInfo.fullName} value={profile.fullName} />
              <InfoRow label={vi.confirmInfo.sbd} value={profile.sbd} />
              <InfoRow label={vi.confirmInfo.examAccount} value={profile.examAccount ?? ''} />
              <InfoRow label={vi.confirmInfo.className} value={profile.className} />
              <InfoRow label={vi.confirmInfo.combo} value={profile.comboCode} />
              <InfoRow label={vi.confirmInfo.subjectGroup} value={profile.subjectGroup} />
              <InfoRow label={vi.confirmInfo.subject} value={profile.subjectName} />
              <InfoRow label={vi.confirmInfo.session} value={profile.sessionName} />
              <InfoRow label={vi.confirmInfo.room} value={profile.labRoom} />
              <InfoRow label={vi.confirmInfo.school} value={profile.schoolName} />
            </dl>
          )}

          <p className="confirm-info-page__hint">{vi.confirmInfo.wrongHint}</p>

          <div className="confirm-info-page__actions">
            <button type="button" className="cbt-btn cbt-btn-outline confirm-info-page__logout" onClick={logout}>
              {vi.confirmInfo.logout}
            </button>
            <button
              type="button"
              className="cbt-btn cbt-btn-primary confirm-info-page__confirm"
              disabled={loading || !!error || !profile}
              onClick={onConfirmed}
            >
              {vi.confirmInfo.confirm}
            </button>
          </div>
        </div>
      </div>

      {!production && (
        <footer className="confirm-info-page__footer">
          <span>Trang xác nhận thông tin</span>
        </footer>
      )}
    </div>
  );
}
