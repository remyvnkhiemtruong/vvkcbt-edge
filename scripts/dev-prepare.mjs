import { execSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { cwd: root, stdio: 'inherit', shell: true, ...opts });
}

function tryRun(cmd) {
  try {
    run(cmd);
    return true;
  } catch {
    return false;
  }
}

function isPortOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPorts(ports, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const results = await Promise.all(ports.map((p) => isPortOpen('127.0.0.1', p)));
    if (results.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

// 1. .env
const envPath = path.join(root, '.env');
const envExample = path.join(root, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envPath);
  console.log('Created .env from .env.example');
}

// 1b. Validate DATABASE_URL
function freePort(port) {
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const m = line.trim().match(/\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
            console.log(`Freed port ${port} (PID ${pid})`);
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      tryRun(`npx kill-port ${port}`);
    }
  } catch {
    /* port likely free */
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const envVars = { ...loadEnvFile(envExample), ...loadEnvFile(envPath) };
const databaseUrl = process.env.DATABASE_URL || envVars.DATABASE_URL;
if (!databaseUrl || typeof databaseUrl !== 'string') {
  console.error('ERROR: DATABASE_URL is missing. Set it in .env at the monorepo root.');
  process.exit(1);
}
try {
  const parsed = new URL(databaseUrl);
  if (!parsed.password) {
    console.error('ERROR: DATABASE_URL must include a password (e.g. postgresql://user:pass@host:5432/db).');
    process.exit(1);
  }
} catch {
  console.error('ERROR: DATABASE_URL is not a valid URL.');
  process.exit(1);
}

// 2. Free API port before dev servers start
freePort(3000);

// 3. Native infra (Postgres + Redis)
console.log('Checking PostgreSQL + Redis...');

const lightweight = (process.env.EDGE_LIGHTWEIGHT || envVars.EDGE_LIGHTWEIGHT) === 'true';
const pgUp = await isPortOpen('127.0.0.1', 5432);
const redisUp = await isPortOpen('127.0.0.1', 6379);

if (!pgUp || (!redisUp && !lightweight)) {
  const isWin = process.platform === 'win32';
  console.error('\n========================================');
  console.error('  Postgres (5432) hoặc Redis (6379) chưa chạy');
  console.error('========================================');
  console.error(`  PostgreSQL: ${pgUp ? 'OK' : 'CHƯA MỞ'}`);
  console.error(`  Redis:      ${redisUp ? 'OK' : lightweight ? 'BỎ QUA (EDGE_LIGHTWEIGHT=true)' : 'CHƯA MỞ'}`);
  console.error('');
  if (isWin) {
    console.error('  Chạy setup tự động: scripts\\setup-windows.bat');
    console.error('  Hoặc: scripts\\setup-windows.bat --dev');
  } else {
    console.error('  Chạy setup tự động: bash scripts/setup-linux.sh');
    console.error('  Hoặc: bash scripts/setup-linux.sh --dev');
  }
  console.error('');
  console.error('  Không có Redis: đặt EDGE_LIGHTWEIGHT=true trong .env');
  console.error('  Chi tiết: docs/NATIVE-DEPLOY.md');
  console.error('========================================\n');
  process.exit(1);
}

// 3b. Wait for ports
console.log('Waiting for database' + (lightweight ? '' : ' and Redis') + '...');
const portsToWait = lightweight ? [5432] : [5432, 6379];
const ready = await waitForPorts(portsToWait, 120000);
if (!ready) {
  console.error('ERROR: Postgres/Redis không phản hồi sau 120s.');
  process.exit(1);
}

// 4. Build shared types (API depends on dist)
tryRun('npm run build -w @vnu/shared-types');
tryRun('npm run build -w @vnu/exam-package-kit');

// 5. Migrations (optional in dev — TypeORM synchronize also applies schema)
if (!tryRun('npm run migration:run')) {
  console.warn('Migration skipped (schema may already exist via synchronize in development).');
}

// 6. Seed demo data (idempotent)
tryRun('npm run seed');

// 7. Print dev credentials if available
const credPath = path.join(root, 'dev-credentials.json');
if (fs.existsSync(credPath)) {
  const cred = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  console.log('\n========================================');
  console.log('  VNU Edge Exam — Development ready');
  console.log('========================================');
  console.log(`  API:     http://127.0.0.1:3000/api/infra/health`);
  console.log(`  Student: http://127.0.0.1:5173/student/`);
  console.log(`  Proctor: http://127.0.0.1:5174/proctor/`);
  console.log(`  Launcher: http://127.0.0.1:3099/dev-launcher.html  (npm run dev:launcher)`);
  console.log(`  Composer: repo vnu-composer (standalone)`);
  console.log(`  Waiting: file://${path.join(root, 'scripts/waiting-room-diagnostic.html')}`);
  console.log('  Student/Proctor sẽ chờ API health trước khi mở Vite...');
  console.log('----------------------------------------');
  console.log(`  TN THPT Session: ${cred.tnExamSessionId}`);
  console.log(`  GDPT Session:    ${cred.gdptExamSessionId}`);
  console.log(`  SBD: ${cred.sbdFrom}-${cred.sbdTo}  |  PIN: ${cred.pin}`);
  console.log('========================================\n');
}
