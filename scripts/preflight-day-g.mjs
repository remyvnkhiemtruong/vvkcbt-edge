#!/usr/bin/env node
/**
 * Pre-flight ngày G — TCP ports, API health, fonts, branding.
 * Usage: node scripts/preflight-day-g.mjs [--api http://127.0.0.1:3000]
 */
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiBase = process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : 'http://127.0.0.1:3000';

const checks = [];

function pass(item, detail = '') {
  checks.push({ item, ok: true, detail });
  console.log(`✓ ${item}${detail ? ` — ${detail}` : ''}`);
}

function fail(item, detail = '') {
  checks.push({ item, ok: false, detail });
  console.error(`✗ ${item}${detail ? ` — ${detail}` : ''}`);
}

function tcpCheck(host, port, label) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 3000 }, () => {
      s.destroy();
      pass(label, `${host}:${port}`);
      resolve(true);
    });
    s.on('error', () => {
      fail(label, `${host}:${port} không mở`);
      resolve(false);
    });
    s.on('timeout', () => {
      s.destroy();
      fail(label, 'timeout');
      resolve(false);
    });
  });
}

async function main() {
  console.log('VVKCBT Pre-flight ngày G\n');

  await tcpCheck('127.0.0.1', 5432, 'PostgreSQL');
  await tcpCheck('127.0.0.1', 6379, 'Redis');
  await tcpCheck('127.0.0.1', 3000, 'API port');

  try {
    const r = await fetch(`${apiBase}/api/infra/health`);
    const d = await r.json();
    if (d.status === 'ok' || d.status === 'degraded') {
      pass('API health', d.status);
      for (const [k, v] of Object.entries(d.checks ?? {})) {
        if (String(v).includes('error')) fail(`health.${k}`, String(v));
        else pass(`health.${k}`, String(v));
      }
    } else fail('API health', JSON.stringify(d));
  } catch (e) {
    fail('API health', e instanceof Error ? e.message : 'unknown');
  }

  const fontDirs = [
    'apps/web/student/public/fonts',
    'apps/web/proctor/public/fonts',
  ];
  const fontNames = ['BeVietnamPro-Regular.woff2', 'BeVietnamPro-Bold.woff2'];
  for (const dir of fontDirs) {
    for (const f of fontNames) {
      const p = path.join(root, dir, f);
      if (fs.existsSync(p)) pass(`Font ${dir}/${f}`);
      else fail(`Font ${dir}/${f}`, 'thiếu — dùng fallback hệ thống');
    }
  }

  for (const app of ['student', 'proctor']) {
    const logo = path.join(root, `apps/web/${app}/public/branding/logo.png`);
    if (fs.existsSync(logo)) pass(`Branding ${app}`);
    else fail(`Branding ${app}`, 'logo.png thiếu');
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.error('\nPre-flight FAILED — xử lý trước ngày G.');
    process.exit(1);
  }
  console.log('\nPre-flight OK.');
}

main();
