#!/usr/bin/env node
/**
 * Tạo fixture ZIP tối thiểu 1 môn cho E2E (dry-run).
 * Chạy: node scripts/build-e2e-fixture.mjs
 * Yêu cầu: npm run build trong vnu-composer trước.
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const edgeRoot = path.resolve(__dirname, '..');
const composerRoot = path.resolve(edgeRoot, '..', 'vnu-composer');
const outDir = path.join(edgeRoot, 'e2e', 'fixtures');
const outFile = path.join(outDir, 'exam-package-sample.meta.json');

mkdirSync(outDir, { recursive: true });

writeFileSync(
  outFile,
  JSON.stringify(
    {
      note: 'Chạy dry-run E2E với ZIP xuất từ Composer (môn MATH). Đặt file tại e2e/fixtures/exam-package-sample.zip',
      composerExport: 'POST /api/composer/packages/export-by-subject { subjectCode: "MATH" }',
      composerRoot,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${outFile}`);
console.log('Xuất ZIP từ Composer và lưu thành e2e/fixtures/exam-package-sample.zip để Playwright dry-run.');
