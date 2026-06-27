import './theme/cbt-base.css';
import './theme/exam-theme.css';
import './styles/exam-view.css';

export { KaTeXBlock } from './components/KaTeXBlock';
export { RichTextContent, richTextToHtml } from './components/RichTextContent';
export { RichTextField } from './components/RichTextField';
export type { RichTextFieldProps } from './components/RichTextField';
export { QuestionRenderer } from './components/QuestionRenderer';
export { TrueFalseRenderer } from './components/TrueFalseRenderer';
export { ShortAnswerRenderer } from './components/ShortAnswerRenderer';
export { InformaticsCodeRenderer } from './components/InformaticsCodeRenderer';
export { DualCodeBlockView } from './components/DualCodeBlockView';
export { ClusterSubtypeRenderer, ClusterContextPreview } from './components/ClusterSubtypeRenderer';
export { splitPassageGaps, wrapSelection } from './utils/rich-text-parser';
export type { PassageSegment } from './utils/rich-text-parser';
export { ExamViewShell } from './components/ExamViewShell';
export type { ExamUiMode, ExamQuestion, ExamViewShellProps } from './components/ExamViewShell';
export { ExamQuestionPalette } from './components/ExamQuestionPalette';
export { ExamThemeToggle } from './components/ExamThemeToggle';
export { useExamTheme } from './hooks/useExamTheme';
export type { ExamTheme, ExamThemePreference } from './hooks/useExamTheme';
export {
  buildExamParts,
  buildExamClusters,
  buildClusterRuns,
  buildViewGroups,
  findPartIndex,
  findClusterIndex,
  findViewGroupIndex,
  getPartLabelVi,
  isQuestionAnswered,
  countAnswered,
  isReorderClusterRun,
  clusterRunHasContext,
} from './utils/exam-clusters';
export type { ExamPart, ExamViewGroup, ExamClusterRun } from './utils/exam-clusters';
export { CbtBrandLogo } from './components/CbtBrandLogo';
export { CbtStatusBadge } from './components/CbtStatusBadge';
export { CbtMachineCard, mapProctorStatus } from './components/CbtMachineCard';
export type { MachineStatus } from './components/CbtMachineCard';
export { CbtPageShell } from './layout/CbtPageShell';
export { CbtCard } from './layout/CbtCard';
export { CbtDataTable } from './components/CbtDataTable';
export type { CbtColumn } from './components/CbtDataTable';
export { ApiStatusBanner } from './ApiStatusBanner';
export { AudioPlayer } from './components/AudioPlayer';
export { GracePeriodOverlay } from './components/GracePeriodOverlay';
export { isRunningInSEB } from './utils/seb';
export { requiresSebLock } from './utils/exam-lock';
export { formatRemaining } from './utils/exam-format';
export { createSocket } from './socket';
export { vi, SCHOOL_NAME, APP_AUTHOR, isProductionUi } from './i18n/vi';
export {
  SO_GD_DISPLAY,
  SCHOOL_BRAND_DISPLAY,
  SCHOOL_LOGO_URL,
  SCHOOL_LOGO_PNG_URL,
  resolveSchoolLogoUrl,
  resolveSchoolLogoPngUrl,
} from './i18n/brand';
export {
  getSubjectNameVi,
  formatSlotStatus,
  formatAuditEvent,
  formatAuditDetail,
  formatHealthCheckValue,
  formatMachineStatus,
  translateApiError,
} from './i18n/maps';
