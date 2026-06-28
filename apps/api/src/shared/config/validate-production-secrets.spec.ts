import { validateProductionSecrets } from './validate-production-secrets';

const validHash = '$2b$10$abcdefghijklmnopqrstuvwx.yz012345678901234567890123456';

function baseProductionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(32),
    ANONYMIZATION_SALT: 'random-salt-value-here',
    AUDIO_ENCRYPTION_KEY: 'fedcba9876543210fedcba9876543210',
    ADMIN_PASSWORD_HASH: validHash,
    PROCTOR_PASSWORD_HASH: validHash,
    COMPOSER_PASSWORD_HASH: validHash,
  };
}

describe('validateProductionSecrets', () => {
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('skips validation when not production', () => {
    expect(() =>
      validateProductionSecrets({ NODE_ENV: 'development', ALLOW_DEFAULT_PROCTOR: 'true' }),
    ).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits when ALLOW_DEFAULT_PROCTOR=true in production', () => {
    expect(() =>
      validateProductionSecrets({ ...baseProductionEnv(), ALLOW_DEFAULT_PROCTOR: 'true' }),
    ).toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith(
      'FATAL: ALLOW_DEFAULT_PROCTOR=true không được phép khi production',
    );
  });

  it('exits when required secrets are missing', () => {
    const env = baseProductionEnv();
    delete env.PROCTOR_PASSWORD_HASH;
    expect(() => validateProductionSecrets(env)).toThrow('process.exit');
  });

  it('exits when JWT_SECRET uses placeholder', () => {
    expect(() =>
      validateProductionSecrets({
        ...baseProductionEnv(),
        JWT_SECRET: 'change-me-in-production',
      }),
    ).toThrow('process.exit');
  });

  it('passes with valid production env', () => {
    expect(() => validateProductionSecrets(baseProductionEnv())).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
