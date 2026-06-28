import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const edgeRoot = path.resolve(__dirname, '..');

/** Resolve Composer repo root (vvkcbt-composer preferred, vnu-composer legacy). */
export function resolveComposerRoot(fromRoot = edgeRoot) {
  const candidates = [
    process.env.COMPOSER_ROOT,
    path.resolve(fromRoot, '..', 'vvkcbt-composer'),
    path.join(fromRoot, 'vvkcbt-composer'),
    path.resolve(fromRoot, '..', 'vnu-composer'),
    path.join(fromRoot, 'vnu-composer'),
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

/** [edgeRelative, composerRelative] — exact hash match for kit-sync-check */
export const exactPairs = [
  ['apps/web/shared/src/i18n/brand.ts', 'packages/web-shared/src/i18n/brand.ts'],
  ['packages/shared-types/src/blueprint-validator.ts', 'packages/shared-types/src/blueprint-validator.ts'],
  ['packages/shared-types/src/exam-package.ts', 'packages/shared-types/src/exam-package.ts'],
  ['packages/shared-types/src/question-order.ts', 'packages/shared-types/src/question-order.ts'],
  ['packages/shared-types/src/tn-thpt-catalog.ts', 'packages/shared-types/src/tn-thpt-catalog.ts'],
  ['packages/shared-types/src/exam-structure.ts', 'packages/shared-types/src/exam-structure.ts'],
  ['packages/exam-package-kit/src/kit.ts', 'packages/exam-package-kit/src/kit.ts'],
  ['apps/web/shared/src/utils/exam-clusters.ts', 'packages/web-shared/src/utils/exam-clusters.ts'],
  ['apps/web/shared/src/components/ExamViewShell.tsx', 'packages/web-shared/src/components/ExamViewShell.tsx'],
  ['apps/web/shared/src/components/ExamQuestionPalette.tsx', 'packages/web-shared/src/components/ExamQuestionPalette.tsx'],
  ['apps/web/shared/src/components/QuestionRenderer.tsx', 'packages/web-shared/src/components/QuestionRenderer.tsx'],
  ['apps/web/shared/src/components/ClusterSubtypeRenderer.tsx', 'packages/web-shared/src/components/ClusterSubtypeRenderer.tsx'],
  ['apps/web/shared/src/components/RichTextContent.tsx', 'packages/web-shared/src/components/RichTextContent.tsx'],
  ['apps/web/shared/src/components/RichTextField.tsx', 'packages/web-shared/src/components/RichTextField.tsx'],
  ['apps/web/shared/src/components/TrueFalseRenderer.tsx', 'packages/web-shared/src/components/TrueFalseRenderer.tsx'],
  ['apps/web/shared/src/components/ShortAnswerRenderer.tsx', 'packages/web-shared/src/components/ShortAnswerRenderer.tsx'],
  ['apps/web/shared/src/components/InformaticsCodeRenderer.tsx', 'packages/web-shared/src/components/InformaticsCodeRenderer.tsx'],
  ['apps/web/shared/src/components/DualCodeBlockView.tsx', 'packages/web-shared/src/components/DualCodeBlockView.tsx'],
  ['apps/web/shared/src/utils/rich-text-parser.ts', 'packages/web-shared/src/utils/rich-text-parser.ts'],
  ['apps/web/shared/src/utils/media-url.ts', 'packages/web-shared/src/utils/media-url.ts'],
  ['apps/web/shared/src/utils/highlight-code.ts', 'packages/web-shared/src/utils/highlight-code.ts'],
  ['apps/web/shared/src/utils/code-blocks.ts', 'packages/web-shared/src/utils/code-blocks.ts'],
  ['packages/shared-types/src/question-content.ts', 'packages/shared-types/src/question-content.ts'],
  ['apps/web/shared/src/styles/exam-view.css', 'packages/web-shared/src/styles/exam-view.css'],
  ['apps/web/shared/src/theme/exam-theme.css', 'packages/web-shared/src/theme/exam-theme.css'],
];

/** Extra assets synced by sync-kit-to-composer (not all in exactPairs). */
export const extraSyncPairs = [
  ['apps/web/shared/src/components/CbtBrandLogo.tsx', 'packages/web-shared/src/components/CbtBrandLogo.tsx'],
  ['apps/web/shared/src/components/SyntaxHighlightedCode.tsx', 'packages/web-shared/src/components/SyntaxHighlightedCode.tsx'],
  ['apps/web/shared/src/components/KaTeXBlock.tsx', 'packages/web-shared/src/components/KaTeXBlock.tsx'],
  ['apps/web/shared/src/theme/cbt-tokens.css', 'packages/web-shared/src/theme/cbt-tokens.css'],
  ['apps/web/shared/src/i18n/vi.ts', 'packages/web-shared/src/i18n/vi.ts'],
  ['packages/shared-types/src/scoring.ts', 'packages/shared-types/src/scoring.ts'],
  ['packages/shared-types/src/short-answer.ts', 'packages/shared-types/src/short-answer.ts'],
  ['packages/shared-types/src/informatics-branch.ts', 'packages/shared-types/src/informatics-branch.ts'],
  ['packages/shared-types/src/index.ts', 'packages/shared-types/src/index.ts'],
  ['packages/shared-types/src/__fixtures__/blueprint-fixtures.ts', 'packages/shared-types/src/__fixtures__/blueprint-fixtures.ts'],
];
