#!/usr/bin/env node
/**
 * Chờ API Edge sẵn sàng trước khi mở Vite Student/Proctor.
 * Dùng 127.0.0.1 thay localhost (tránh IPv6 ::1 trên Windows).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadPort() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return 3000;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^PORT\s*=\s*(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 3000;
}

const port = process.env.PORT || loadPort();
const url = `http://127.0.0.1:${port}/api/infra/health`;
const timeoutMs = parseInt(process.env.DEV_WAIT_TIMEOUT_MS || '120000', 10);

console.log(`Đang chờ API: ${url} (tối đa ${timeoutMs / 1000}s)...`);

try {
  execSync(`npx wait-on ${url} -t ${timeoutMs}`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  console.log('API đã sẵn sàng.');
} catch {
  console.error('\n❌ Không kết nối được API Edge trong thời gian chờ.\n');
  console.error('Kiểm tra:');
  console.error('  1. PostgreSQL (5432) và Redis (6379) đang chạy');
  console.error('  2. Chạy: npm run dev:prepare  hoặc  docker compose -f docker/docker-compose.yml up -d');
  console.error('  3. Xem log API: npm run dev:api');
  console.error(`  4. Thử tay: curl ${url}\n`);
  process.exit(1);
}
