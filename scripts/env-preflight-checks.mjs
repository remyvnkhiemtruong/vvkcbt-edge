import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const PLACEHOLDERS = {
  JWT_SECRET: ['change-me-in-production', 'dev-secret'],
  ANONYMIZATION_SALT: ['change-me-anonymization-salt'],
  AUDIO_ENCRYPTION_KEY: [
    'GENERATE_YOUR_OWN_32_BYTE_HEX_KEY',
    '0123456789abcdef0123456789abcdef',
  ],
  ADMIN_PASSWORD_HASH: [''],
  PROCTOR_PASSWORD_HASH: [''],
  COMPOSER_PASSWORD_HASH: [''],
};

export function loadEnvString(root, key) {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return process.env[key]?.trim() ?? '';
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return process.env[key]?.trim() ?? '';
}

export function loadEnvFlag(root, key) {
  return loadEnvString(root, key) === 'true';
}

/** Kiểm tra cấu hình production bắt buộc trước ngày thi. */
export function productionEnvChecks(root) {
  const env = (key) => loadEnvString(root, key);
  const checks = [];

  const nodeEnv = env('NODE_ENV');
  checks.push({
    name: 'NODE_ENV production',
    pass: nodeEnv === 'production',
    detail:
      nodeEnv === 'production'
        ? 'production'
        : 'NODE_ENV không phải production — KHÔNG dùng cấu hình này cho thi thật',
  });

  const jwt = env('JWT_SECRET');
  checks.push({
    name: 'JWT_SECRET',
    pass: jwt.length >= 32 && !PLACEHOLDERS.JWT_SECRET.includes(jwt),
    detail: jwt ? `${jwt.length} chars` : 'trống',
  });

  for (const key of ['ANONYMIZATION_SALT', 'AUDIO_ENCRYPTION_KEY', 'ADMIN_PASSWORD_HASH']) {
    const val = env(key);
    const bad = !val || PLACEHOLDERS[key]?.includes(val);
    checks.push({
      name: key,
      pass: !bad,
      detail: bad ? 'thiếu hoặc còn giá trị mẫu' : 'ok',
    });
  }

  if (env('AUDIO_ENCRYPTION_KEY') && env('AUDIO_ENCRYPTION_KEY').slice(0, 32).length < 32) {
    const idx = checks.findIndex((c) => c.name === 'AUDIO_ENCRYPTION_KEY');
    if (idx >= 0) {
      checks[idx] = {
        name: 'AUDIO_ENCRYPTION_KEY',
        pass: false,
        detail: 'phải ≥32 ký tự',
      };
    }
  }

  const disableIp = env('DISABLE_IP_BINDING');
  checks.push({
    name: 'DISABLE_IP_BINDING',
    pass: disableIp !== 'true',
    detail: disableIp === 'true' ? 'phải tắt khi thi thật' : 'ok',
  });

  const allowDefault = env('ALLOW_DEFAULT_PROCTOR');
  checks.push({
    name: 'ALLOW_DEFAULT_PROCTOR',
    pass: allowDefault !== 'true',
    detail: allowDefault === 'true' ? 'phải false/không set' : 'ok',
  });

  return checks;
}
