import './theme/cbt-base.css';
import './styles/exam-view.css';

export { KaTeXBlock } from './components/KaTeXBlock';
export { RichTextContent, richTextToHtml } from './components/RichTextContent';
export { QuestionRenderer } from './components/QuestionRenderer';
export { ExamViewShell } from './components/ExamViewShell';
export type { ExamUiMode, ExamQuestion, ExamViewShellProps } from './components/ExamViewShell';
export { TimerBar } from './components/TimerBar';
export { CbtBrandLogo } from './components/CbtBrandLogo';
export { AudioPlayer } from './components/AudioPlayer';
export { GracePeriodOverlay } from './components/GracePeriodOverlay';
export { CbtStatusBadge } from './components/CbtStatusBadge';
export { CbtDataTable } from './components/CbtDataTable';
export type { CbtColumn } from './components/CbtDataTable';
export { CbtMachineCard, mapProctorStatus } from './components/CbtMachineCard';
export type { MachineStatus } from './components/CbtMachineCard';
export { CbtPageShell } from './layout/CbtPageShell';
export { CbtCard } from './layout/CbtCard';
export { vi, SCHOOL_NAME, APP_AUTHOR, isProductionUi } from './i18n/vi';
export {
  getSubjectNameVi,
  formatSlotStatus,
  formatAuditEvent,
  formatMachineStatus,
  translateApiError,
} from './i18n/maps';
export { isRunningInSEB } from './utils/seb';
export { getExamLockMode, requiresSebLock } from './utils/exam-lock';
export type { ExamLockMode } from './utils/exam-lock';
export { createSocket } from './socket';
export { ApiStatusBanner } from './ApiStatusBanner';
export type { HealthResponse } from './ApiStatusBanner';