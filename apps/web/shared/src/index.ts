import './theme/cbt-base.css';
import './theme/exam-theme.css';
import './styles/exam-view.css';

export { KaTeXBlock } from './components/KaTeXBlock';
export { RichTextContent, richTextToHtml } from './components/RichTextContent';
export { RichTextField } from './components/RichTextField';
export type { RichTextFieldProps } from './components/RichTextField';
export { QuestionRenderer } from './components/QuestionRenderer';
export { ClusterSubtypeRenderer } from './components/ClusterSubtypeRenderer';
export { TrueFalseRenderer } from './components/TrueFalseRenderer';
export { ShortAnswerRenderer } from './components/ShortAnswerRenderer';
export { InformaticsCodeRenderer } from './components/InformaticsCodeRenderer';
export { DualCodeBlockView } from './components/DualCodeBlockView';
export { splitPassageGaps, wrapSelection } from './utils/rich-text-parser';
export type { PassageSegment } from './utils/rich-text-parser';
export { ExamViewShell } from './components/ExamViewShell';
export type { ExamUiMode, ExamQuestion, ExamViewShellProps } from './components/ExamViewShell';
export { ExamQuestionPalette } from './components/ExamQuestionPalette';
export { ExamThemeToggle } from './components/ExamThemeToggle';
export { useExamTheme } from './hooks/useExamTheme';
export type { ExamTheme, ExamThemePreference } from './hooks/useExamTheme';
export { buildExamParts, buildExamClusters, buildViewGroups, findViewGroupIndex, findPartIndex, findClusterIndex, getPartLabelVi, getSplitPaneText, isQuestionAnswered, countAnswered } from './utils/exam-clusters';
export type { ExamPart, ExamViewGroup } from './utils/exam-clusters';
export { formatRemaining } from './utils/exam-format';
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
export { DEFAULT_SCHOOL_NAME } from '@vnu/shared-types';
export {
  getSubjectNameVi,
  formatSlotStatus,
  formatAuditEvent,
  formatAuditDetail,
  formatHealthCheckValue,
  formatMachineStatus,
  translateApiError,
} from './i18n/maps';
export { isRunningInSEB } from './utils/seb';
export { getExamLockMode, requiresSebLock } from './utils/exam-lock';
export type { ExamLockMode } from './utils/exam-lock';
export { createSocket } from './socket';
export { ApiStatusBanner } from './ApiStatusBanner';
export type { HealthResponse } from './ApiStatusBanner';