import { execSync } from 'child_process';
import fs from 'fs';
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

// 3. Docker infra (Postgres + Redis)
console.log('Starting PostgreSQL + Redis...');
if (!tryRun('docker compose -f docker/docker-compose.yml up -d postgres redis')) {
  console.warn(
    'Could not start Docker services. Ensure Postgres (5432) and Redis (6379) are already running.',
  );
}

// 3. Wait for ports
console.log('Waiting for database and Redis...');
tryRun('npx wait-on tcp:localhost:5432 tcp:localhost:6379 -t 120000');

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
  console.log(`  API:     http://localhost:3000/api/infra/health`);
  console.log(`  Student: http://localhost:5173/student/`);
  console.log(`  Proctor: http://localhost:5174/proctor/`);
  console.log(`  Composer: repo vnu-composer (standalone)`);
  console.log(`  Waiting: file://${path.join(root, 'scripts/waiting-room-diagnostic.html')}`);
  console.log('----------------------------------------');
  console.log(`  TN THPT Session: ${cred.tnExamSessionId}`);
  console.log(`  GDPT Session:    ${cred.gdptExamSessionId}`);
  console.log(`  SBD: ${cred.sbdFrom}-${cred.sbdTo}  |  PIN: ${cred.pin}`);
  console.log('========================================\n');
}
