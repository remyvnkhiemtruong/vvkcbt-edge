#!/usr/bin/env node
/**
 * Sinh JWT_SECRET, ANONYMIZATION_SALT, AUDIO_ENCRYPTION_KEY cho .env mới setup.
 * Usage: node scripts/generate-setup-secrets.mjs <path-to-.env>
 */
import fs from 'fs';
import { randomBytes } from 'crypto';

const envPath = process.argv[2];
if (!envPath || !fs.existsSync(envPath)) {
  console.error('Usage: node scripts/generate-setup-secrets.mjs <path-to-.env>');
  process.exit(1);
}

function upsert(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, `${key}=${value}`);
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

let content = fs.readFileSync(envPath, 'utf-8');
content = upsert(content, 'JWT_SECRET', randomBytes(32).toString('hex'));
content = upsert(content, 'ANONYMIZATION_SALT', randomBytes(24).toString('hex'));
content = upsert(content, 'AUDIO_ENCRYPTION_KEY', randomBytes(16).toString('hex'));
fs.writeFileSync(envPath, content);
console.log('Da sinh JWT_SECRET, ANONYMIZATION_SALT, AUDIO_ENCRYPTION_KEY trong .env');
