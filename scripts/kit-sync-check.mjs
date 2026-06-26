import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const edgeRoot = path.resolve(__dirname, '..');
const composerRoot = path.resolve(edgeRoot, '..', 'vnu-composer');

/** [edgeRelative, composerRelative] — exact hash match */
const exactPairs = [
  ['packages/shared-types/src/blueprint-validator.ts', 'packages/shared-types/src/blueprint-validator.ts'],
  ['packages/shared-types/src/exam-package.ts', 'packages/shared-types/src/exam-package.ts'],
  ['packages/exam-package-kit/src/kit.ts', 'packages/exam-package-kit/src/kit.ts'],
];

/** Composer-only files — required markers (column aliases, compose modes) */
const composerMarkerChecks = [
  {
    rel: 'apps/web/src/excelImport.ts',
    markers: [
      "'ngày sinh': 'dateOfBirth'",
      "'giới tính': 'gender'",
      'DanhSachThiSinh',
      "subjects = ['LITERATURE', 'MATH']",
    ],
    label: 'excelImport.ts HEADER_ALIASES',
  },
  {
    rel: 'apps/web/src/composer-labels.ts',
    markers: ['getComposeMode', 'getComposeModeLabel', 'TF_BRANCH_HINT'],
    label: 'composer-labels.ts compose modes',
  },
];

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeBrandLogo(content) {
  return content.replace(/logoUrl = '[^']+'/, "logoUrl = '__BASE__'");
}

let failed = false;

for (const [edgeRel, composerRel] of exactPairs) {
  const a = path.join(edgeRoot, edgeRel);
  const b = path.join(composerRoot, composerRel);
  if (!existsSync(a) || !existsSync(b)) {
    console.error(`MISSING: ${composerRel}`);
    failed = true;
    continue;
  }
  const ha = hash(readFileSync(a));
  const hb = hash(readFileSync(b));
  if (ha !== hb) {
    console.error(`DRIFT: ${composerRel}`);
    failed = true;
  } else {
    console.log(`OK ${composerRel}`);
  }
}

const brandEdge = path.join(edgeRoot, 'apps/web/shared/src/components/CbtBrandLogo.tsx');
const brandComposer = path.join(composerRoot, 'packages/web-shared/src/components/CbtBrandLogo.tsx');
if (existsSync(brandEdge) && existsSync(brandComposer)) {
  const ha = hash(normalizeBrandLogo(readFileSync(brandEdge, 'utf8')));
  const hb = hash(normalizeBrandLogo(readFileSync(brandComposer, 'utf8')));
  if (ha !== hb) {
    console.error('DRIFT: CbtBrandLogo.tsx (beyond logoUrl base path)');
    failed = true;
  } else {
    console.log('OK CbtBrandLogo.tsx (normalized)');
  }
} else {
  console.error('MISSING: CbtBrandLogo.tsx');
  failed = true;
}

for (const rel of [
  'apps/web/shared/src/i18n/vi.ts',
  'packages/web-shared/src/i18n/vi.ts',
]) {
  const full = rel.startsWith('apps/') ? path.join(edgeRoot, rel) : path.join(composerRoot, rel);
  if (!existsSync(full)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
    continue;
  }
  const text = readFileSync(full, 'utf8');
  if (!text.includes('export const APP_AUTHOR') || !text.includes('VVKCBT')) {
    console.error(`DRIFT: ${rel} — thiếu APP_AUTHOR hoặc branding VVKCBT`);
    failed = true;
  } else {
    console.log(`OK ${path.basename(rel)} branding markers`);
  }
}

for (const { rel, markers, label } of composerMarkerChecks) {
  const full = path.join(composerRoot, rel);
  if (!existsSync(full)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
    continue;
  }
  const text = readFileSync(full, 'utf8');
  const missing = markers.filter((m) => !text.includes(m));
  if (missing.length) {
    console.error(`DRIFT: ${label} — thiếu: ${missing.join(', ')}`);
    failed = true;
  } else {
    console.log(`OK ${label}`);
  }
}

const tokensEdge = path.join(edgeRoot, 'apps/web/shared/src/theme/cbt-tokens.css');
const tokensComposer = path.join(composerRoot, 'packages/web-shared/src/theme/cbt-tokens.css');
if (existsSync(tokensEdge) && existsSync(tokensComposer)) {
  const requiredTokens = ['--cbt-primary:', '--cbt-success:', '--cbt-danger:', '--cbt-warning:'];
  const edgeText = readFileSync(tokensEdge, 'utf8');
  const composerText = readFileSync(tokensComposer, 'utf8');
  let tokensOk = true;
  for (const tok of requiredTokens) {
    const inEdge = edgeText.includes(tok);
    const inComposer = composerText.includes(tok);
    if (!inEdge || !inComposer) {
      console.error(`DRIFT: CSS token ${tok} — edge=${inEdge} composer=${inComposer}`);
      failed = true;
      tokensOk = false;
    }
  }
  if (tokensOk) console.log('OK CSS design tokens (primary/success/danger/warning)');
} else {
  console.error('MISSING: cbt-tokens.css in Edge or Composer web-shared');
  failed = true;
}

if (failed) process.exit(1);
console.log('Kit sync check passed.');
