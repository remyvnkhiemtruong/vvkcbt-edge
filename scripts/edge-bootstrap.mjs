#!/usr/bin/env node
/**
 * VVKCBT Edge LAN pre-exam checklist — native or Docker deploy.
 * Usage: node scripts/edge-bootstrap.mjs [--api http://localhost:3000]
 */
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const apiBase = process.argv.includes('--api')
  ? process.argv[process.argv.indexOf('--api') + 1]
  : process.env.VITE_API_URL || 'http://localhost:3000';

const checks = [];

const FONT_NAMES = [
  'BeVietnamPro-Regular.woff2',
  'BeVietnamPro-SemiBold.woff2',
  'BeVietnamPro-Bold.woff2',
];

function checkTcp(port, label) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' }, () => {
      sock.end();
      resolve({ name: label, pass: true, detail: `port ${port}` });
    });
    sock.on('error', () => resolve({ name: label, pass: false, detail: `port ${port} closed` }));
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve({ name: label, pass: false, detail: `port ${port} timeout` });
    });
  });
}

function checkFonts(label, dir) {
  const missing = FONT_NAMES.filter((f) => !existsSync(resolve(dir, f)));
  return {
    name: `Fonts offline (${label})`,
    pass: missing.length === 0,
    detail: missing.length ? `Thiếu: ${missing.join(', ')}` : '3/3 WOFF2',
  };
}

function checkLogo(label, logoPath) {
  const ok = existsSync(logoPath);
  return {
    name: `Logo VVK (${label})`,
    pass: ok,
    detail: ok ? 'branding/logo.png' : 'Copy LogoVVK.png → public/branding/logo.png',
  };
}

function checkDist() {
  const student = existsSync(resolve(root, 'apps/web/student/dist/index.html'));
  const proctor = existsSync(resolve(root, 'apps/web/proctor/dist/index.html'));
  return {
    name: 'SPA dist',
    pass: student && proctor,
    detail: student && proctor ? 'student + proctor' : 'Chạy npm run build',
  };
}

function checkNginxPortable() {
  const exe = resolve(root, 'tools/nginx/nginx.exe');
  const ok = existsSync(exe);
  return {
    name: 'nginx portable',
    pass: ok,
    detail: ok ? 'tools/nginx/nginx.exe' : 'Tải nginx vào tools/nginx/ (xem NATIVE-DEPLOY.md)',
  };
}

function checkDockerOptional() {
  try {
    const out = execSync('docker compose -f docker/docker-compose.yml ps --format json', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const running = out
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter((l) => {
        try {
          return JSON.parse(l).State === 'running';
        } catch {
          return false;
        }
      });
    return {
      name: 'Docker stack (tùy chọn)',
      pass: running.length > 0,
      detail: running.length ? `${running.length} container(s)` : 'Dùng native — OK nếu Postgres chạy',
    };
  } catch {
    return {
      name: 'Docker stack (tùy chọn)',
      pass: true,
      detail: 'Không dùng Docker — native deploy',
    };
  }
}

async function get(path) {
  const res = await fetch(`${apiBase}/api${path}`);
  return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : await res.text() };
}

async function main() {
  console.log('VVKCBT Edge Bootstrap — LAN checklist\n');
  console.log(`API: ${apiBase}\n`);

  checks.push(checkDist());
  checks.push(checkLogo('student', resolve(root, 'apps/web/student/public/branding/logo.png')));
  checks.push(checkLogo('proctor', resolve(root, 'apps/web/proctor/public/branding/logo.png')));
  checks.push(checkFonts('student', resolve(root, 'apps/web/student/public/fonts')));
  checks.push(checkNginxPortable());
  checks.push(await checkTcp(5432, 'PostgreSQL'));
  checks.push(await checkTcp(6379, 'Redis (hoặc EDGE_LIGHTWEIGHT=true)'));
  checks.push(checkDockerOptional());

  try {
    const health = await get('/infra/health');
    const redisOk =
      health.body?.checks?.redis === 'ok' ||
      String(health.body?.checks?.redis).startsWith('skipped');
    checks.push({
      name: 'Health API',
      pass: health.ok && (health.body?.status !== 'degraded' || redisOk),
      detail: health.ok ? JSON.stringify(health.body?.checks ?? health.body) : health.body,
    });
  } catch (err) {
    checks.push({
      name: 'Health API',
      pass: false,
      detail: err instanceof Error ? err.message : 'unreachable',
    });
  }

  try {
    const pkg = await get('/proctor/packages/status');
    checks.push({
      name: 'Exam package imported',
      pass: pkg.ok && !!pkg.body?.examSessionId,
      detail: pkg.body?.examSessionId ? `session ${pkg.body.examSessionId}` : 'Import ZIP via CBT - Viewer',
    });
  } catch {
    checks.push({
      name: 'Exam package imported',
      pass: false,
      detail: 'Import ZIP trên CBT - Viewer',
    });
  }

  const required = checks.filter(
    (c) => !c.name.includes('tùy chọn') && c.name !== 'Exam package imported' && c.name !== 'Redis (hoặc EDGE_LIGHTWEIGHT=true)',
  );
  const redisCheck = checks.find((c) => c.name.startsWith('Redis'));
  const redisPass = redisCheck?.pass || process.env.EDGE_LIGHTWEIGHT === 'true';

  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }

  const allPass =
    required.every((c) => c.pass) &&
    redisPass &&
    checks.find((c) => c.name === 'Health API')?.pass;

  console.log('\n---');
  console.log(allPass ? 'READY for exam day (VVKCBT native).' : 'NOT READY — fix items above.');
  console.log('\nNative: scripts\\start-edge-server.bat | Client 2GB: scripts\\start-proctor-client.bat');
  console.log('Thí sinh: http://<IP_LAN>/student/ (Chrome kiosk — docs/BROWSER-KIOSK.md)');
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
