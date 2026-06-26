#!/usr/bin/env node
/**
 * Hướng dẫn tải font Be Vietnam Pro cho offline LAN.
 * Chạy từ repo VNU: node scripts/download-fonts.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const targets = [
  'apps/web/student/public/fonts',
  'apps/web/proctor/public/fonts',
];

const readme = `# Be Vietnam Pro (offline)

Tải 3 file WOFF2 từ Google Fonts hoặc [fonts.google.com/specimen/Be+Vietnam+Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro):

- BeVietnamPro-Regular.woff2
- BeVietnamPro-SemiBold.woff2
- BeVietnamPro-Bold.woff2

Đặt vào thư mục này. Composer: vnu-composer/apps/web/public/fonts/
`;

for (const rel of targets) {
  const dir = path.join(root, rel);
  mkdirSync(dir, { recursive: true });
  const readmePath = path.join(dir, 'README.md');
  if (!existsSync(readmePath)) writeFileSync(readmePath, readme);
  console.log(`OK ${rel}/`);
}

console.log('\nFont WOFF2 phải tải thủ công (bản quyền / mạng LAN). Xem README trong từng thư mục fonts.');
