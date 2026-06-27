#!/usr/bin/env node
/**
 * Upsert proctor staff user for exam-day BAT launcher.
 * Usage: node scripts/seed-proctor-user.mjs <username> <password>
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const username = process.argv[2]?.trim() || 'proctor';
const password = process.argv[3] ?? 'proctor123';
if (!username || !password) {
  console.error('Usage: node scripts/seed-proctor-user.mjs [username] [password]');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set — copy .env.example to .env first');
  process.exit(1);
}

let bcrypt;
let pg;
try {
  bcrypt = require('bcrypt');
  pg = require('pg');
} catch (err) {
  console.error('Missing bcrypt/pg — run npm install at repo root');
  console.error(err?.message ?? err);
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  const existing = await client.query('SELECT id FROM staff_users WHERE username = $1', [username]);
  if (existing.rows.length) {
    await client.query(
      `UPDATE staff_users SET password_hash = $1, role = 'proctor', updated_at = NOW() WHERE username = $2`,
      [hash, username],
    );
    console.log(`Updated proctor user "${username}"`);
  } else {
    await client.query(
      `INSERT INTO staff_users (id, username, role, password_hash, school_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'proctor', $2, NULL, NOW(), NOW())`,
      [username, hash],
    );
    console.log(`Created proctor user "${username}"`);
  }
} finally {
  await client.end();
}
