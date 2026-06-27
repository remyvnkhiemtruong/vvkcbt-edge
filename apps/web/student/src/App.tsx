import { useEffect, useState } from 'react';
import { useExamStore } from './store';
import LoginPage from './pages/LoginPage';
import ConfirmInfoPage from './pages/ConfirmInfoPage';
import RulesPage from './pages/RulesPage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import { useOfflineSync } from './hooks/useOffline';
import { useStudentSocket } from './hooks/useStudentSocket';
import { studentApi } from './api';
import { vi } from '@shared/index';

export default function App() {
  useOfflineSync();
  useStudentSocket();
  const token = useExamStore((s) => s.token);
  const submitted = useExamStore((s) => s.submitted);
  const rulesAccepted = useExamStore((s) => s.rulesAccepted);
  const identityConfirmed = useExamStore((s) => s.identityConfirmed);
  const setRulesAccepted = useExamStore((s) => s.setRulesAccepted);
  const setIdentityConfirmed = useExamStore((s) => s.setIdentityConfirmed);
  const setExam = useExamStore((s) => s.setExam);
  const [bootstrapped, setBootstrapped] = useState(!token);

  useEffect(() => {
    if (!token || submitted) {
      setBootstrapped(true);
      return;
    }
    let cancelled = false;
    studentApi
      .getExam()
      .then((data) => {
        if (cancelled) return;
        if (data.examStarted) {
          setIdentityConfirmed(true);
          setRulesAccepted(true);
          setExam(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, submitted, setIdentityConfirmed, setRulesAccepted, setExam]);

  if (!token) return <LoginPage />;
  if (!bootstrapped) {
    return <div className="loading">{vi.confirmInfo.loading}</div>;
  }
  if (submitted) return <ResultPage />;
  if (!identityConfirmed) {
    return <ConfirmInfoPage onConfirmed={() => setIdentityConfirmed(true)} />;
  }
  if (!rulesAccepted) {
    return <RulesPage onAccepted={() => setRulesAccepted(true)} />;
  }
  return <ExamPage />;
}
