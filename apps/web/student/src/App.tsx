import { useExamStore } from './store';
import LoginPage from './pages/LoginPage';
import SlotsPage from './pages/SlotsPage';
import RulesPage from './pages/RulesPage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import { useOfflineSync } from './hooks/useOffline';

export default function App() {
  useOfflineSync();
  const token = useExamStore((s) => s.token);
  const submitted = useExamStore((s) => s.submitted);
  const rulesAccepted = useExamStore((s) => s.rulesAccepted);
  const showSlots = useExamStore((s) => s.showSlots);
  const setRulesAccepted = useExamStore((s) => s.setRulesAccepted);
  const setShowSlots = useExamStore((s) => s.setShowSlots);

  if (!token) return <LoginPage />;
  if (submitted) return <ResultPage />;
  if (showSlots) {
    return <SlotsPage onStartExam={() => setShowSlots(false)} />;
  }
  if (!rulesAccepted) {
    return <RulesPage onAccepted={() => setRulesAccepted(true)} />;
  }
  return <ExamPage />;
}
