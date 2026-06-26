#!/usr/bin/env node
/**
 * VVKCBT E2E validation checklist (automated smoke tests).
 * Run after build on proctor machine or CI.
 *
 * Usage: node scripts/test-e2e-checklist.mjs [--api http://localhost:3000]
 */
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const apiBase = process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : 'http://localhost:3000';

const steps = [];

function record(name, pass, detail = '') {
  steps.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('VVKCBT E2E Checklist\n');

  record('Native server BAT', existsSync(resolve(root, 'scripts/start-edge-server.bat')));
  record('Thin proctor client BAT', existsSync(resolve(root, 'scripts/start-proctor-client.bat')));
  record('Browser kiosk BAT', existsSync(resolve(root, 'scripts/student-kiosk.bat')));
  record('Native deploy doc', existsSync(resolve(root, 'docs/NATIVE-DEPLOY.md')));
  record('Browser kiosk doc', existsSync(resolve(root, 'docs/BROWSER-KIOSK.md')));
  record('Seed script exists', existsSync(resolve(root, 'scripts/seed-proctor-user.mjs')));
  record('Import ZIP script exists', existsSync(resolve(root, 'scripts/import-exam-zip.ps1')));
  record('Student dist built', existsSync(resolve(root, 'apps/web/student/dist/index.html')));
  record('Proctor dist built', existsSync(resolve(root, 'apps/web/proctor/dist/index.html')));
  record('Logo student', existsSync(resolve(root, 'apps/web/student/public/branding/logo.png')));
  record('SEB plist template (optional)', existsSync(resolve(root, 'scripts/seb/VVKCBT-Student.plist')));

  try {
    const res = await fetch(`${apiBase}/api/infra/health`);
    const body = await res.json();
    record('API health reachable (optional)', res.ok, body.status);
  } catch (err) {
    record('API health reachable (optional)', true, 'skipped — start start-edge-server.bat to verify live');
  }

  const fileChecks = steps.filter((s) => !s.name.includes('API health'));
  const allPass = fileChecks.every((s) => s.pass);

  console.log('\nManual steps (exam day):');
  console.log('  1. Máy chủ: scripts\\start-edge-server.bat');
  console.log('  2. Máy giám thị 2GB: scripts\\start-proctor-client.bat');
  console.log('  3. Login CBT - Viewer → import Composer ZIP');
  console.log('  4. Chrome kiosk 3–5 máy mẫu → login → nộp (docs/BROWSER-KIOSK.md)');
  console.log('  5. Proctor grid shows active students');

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
