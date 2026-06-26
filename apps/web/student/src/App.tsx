import { useExamStore } from './store';
import LoginPage from './pages/LoginPage';
import RulesPage from './pages/RulesPage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import { useOfflineSync } from './hooks/useOffline';
import { useStudentSocket } from './hooks/useStudentSocket';

export default function App() {
  useOfflineSync();
  useStudentSocket();
  const token = useExamStore((s) => s.token);
  const submitted = useExamStore((s) => s.submitted);
  const rulesAccepted = useExamStore((s) => s.rulesAccepted);
  const setRulesAccepted = useExamStore((s) => s.setRulesAccepted);

  if (!token) return <LoginPage />;
  if (submitted) return <ResultPage />;
  if (!rulesAccepted) {
    return <RulesPage onAccepted={() => setRulesAccepted(true)} />;
  }
  return <ExamPage />;
}
