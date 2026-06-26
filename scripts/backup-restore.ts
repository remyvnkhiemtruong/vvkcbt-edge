#!/usr/bin/env ts-node
/**
 * Backup / restore helper for VNU Edge LAN.
 * Usage:
 *   npx ts-node scripts/backup-restore.ts backup
 *   npx ts-node scripts/backup-restore.ts restore <filename.zip>
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

config({ path: resolve(__dirname, '../.env') });

const cmd = process.argv[2];
const backupDir = process.env.BACKUP_DIR || './backups';

if (cmd === 'backup') {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = resolve(backupDir, `manual-${ts}.sql`);
  fs.mkdirSync(backupDir, { recursive: true });
  execSync(`pg_dump "${dbUrl}" -f "${out}"`, { stdio: 'inherit' });
  console.log('Wrote', out);
} else if (cmd === 'restore') {
  const file = process.argv[3];
  if (!file) throw new Error('Usage: restore <file.sql>');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL required');
  const path = resolve(backupDir, file);
  execSync(`psql "${dbUrl}" -f "${path}"`, { stdio: 'inherit' });
  console.log('Restored from', path);
} else if (cmd === 'list') {
  console.log(fs.readdirSync(backupDir).join('\n'));
} else {
  console.log('Commands: backup | restore <file> | list');
}
