/**
 * Xóa toàn bộ dữ liệu ca thi trên Edge (giữ students/schools nếu có).
 * Usage: npm run reset:exam
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidates = [path.join(root, '.env'), path.join(root, '.env.example')];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'DATABASE_URL' && val) return val;
    }
  }
  return 'postgresql://vnu:vnu_secret@localhost:5432/vnu_exam';
}

/** Thứ tự xóa theo FK (con trước, cha sau). */
const TABLES = [
  'grading_flags',
  'appeal_requests',
  'anonymization_map',
  'proctor_actions',
  'audit_logs',
  'student_subject_slots',
  'student_sessions',
  'gdpt_subject_streams',
  'exam_papers',
  'exam_sessions',
  'question_bank',
  'question_clusters',
  'media_assets',
];

async function main() {
  const url = loadDatabaseUrl();
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log('Đang xóa dữ liệu ca thi…');
  for (const table of TABLES) {
    const res = await client.query(`DELETE FROM ${table}`);
    console.log(`  ${table}: ${res.rowCount ?? 0} dòng`);
  }

  await client.end();

  const uploadDir = process.env.UPLOAD_DIR || path.join(root, 'uploads');
  if (fs.existsSync(uploadDir)) {
    for (const f of fs.readdirSync(uploadDir)) {
      if (f === '.gitkeep') continue;
      fs.rmSync(path.join(uploadDir, f), { force: true, recursive: true });
    }
    console.log(`  uploads/: đã dọn`);
  }

  console.log('\nXong — máy sạch, có thể import ZIP mới (không cần xuất gói phòng trước).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
