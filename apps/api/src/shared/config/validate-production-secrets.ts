/** Giá trị mẫu trong .env.example — không được dùng khi production. */
export const ENV_PLACEHOLDER_VALUES: Record<string, string[]> = {
  JWT_SECRET: ['change-me-in-production', 'dev-secret'],
  ANONYMIZATION_SALT: ['change-me-anonymization-salt'],
  AUDIO_ENCRYPTION_KEY: [
    '0123456789abcdef0123456789abcdef',
    'GENERATE_YOUR_OWN_32_BYTE_HEX_KEY',
  ],
};

export function validateProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  if (env.ALLOW_DEFAULT_PROCTOR === 'true') {
    console.error('FATAL: ALLOW_DEFAULT_PROCTOR=true không được phép khi production');
    process.exit(1);
  }

  const required = [
    'JWT_SECRET',
    'ANONYMIZATION_SALT',
    'AUDIO_ENCRYPTION_KEY',
    'ADMIN_PASSWORD_HASH',
    'PROCTOR_PASSWORD_HASH',
    'COMPOSER_PASSWORD_HASH',
  ];
  const missing = required.filter((k) => !env[k]?.trim());
  if (missing.length) {
    console.error(`FATAL: Missing required env in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (env.JWT_SECRET === 'dev-secret' || env.JWT_SECRET!.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 chars in production');
    process.exit(1);
  }

  for (const [key, placeholders] of Object.entries(ENV_PLACEHOLDER_VALUES)) {
    const val = env[key]?.trim();
    if (val && placeholders.includes(val)) {
      console.error(`FATAL: ${key} must not use example/placeholder value in production`);
      process.exit(1);
    }
  }

  for (const hashKey of ['ADMIN_PASSWORD_HASH', 'PROCTOR_PASSWORD_HASH', 'COMPOSER_PASSWORD_HASH']) {
    const hash = env[hashKey]?.trim();
    if (hash && !hash.startsWith('$2')) {
      console.error(`FATAL: ${hashKey} must be a bcrypt hash in production`);
      process.exit(1);
    }
  }

  if ((env.AUDIO_ENCRYPTION_KEY?.trim().slice(0, 32).length ?? 0) < 32) {
    console.error('FATAL: AUDIO_ENCRYPTION_KEY must be at least 32 chars in production');
    process.exit(1);
  }
}
