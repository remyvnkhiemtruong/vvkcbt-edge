import { resolveAudioEncryptionKey, InfraController } from './infra.controller';
import { StudentSession } from '../database/entities/student-session.entity';
import type { Request } from 'express';

describe('resolveAudioEncryptionKey', () => {
  const original = process.env.AUDIO_ENCRYPTION_KEY;

  afterEach(() => {
    if (original !== undefined) process.env.AUDIO_ENCRYPTION_KEY = original;
    else delete process.env.AUDIO_ENCRYPTION_KEY;
  });

  it('throws when AUDIO_ENCRYPTION_KEY is missing', () => {
    delete process.env.AUDIO_ENCRYPTION_KEY;
    expect(() => resolveAudioEncryptionKey()).toThrow('FATAL: AUDIO_ENCRYPTION_KEY');
  });

  it('throws when key is shorter than 32 characters', () => {
    process.env.AUDIO_ENCRYPTION_KEY = 'short';
    expect(() => resolveAudioEncryptionKey()).toThrow('FATAL: AUDIO_ENCRYPTION_KEY');
  });

  it('accepts a valid 32+ character key', () => {
    process.env.AUDIO_ENCRYPTION_KEY = 'fedcba9876543210fedcba9876543210';
    const key = resolveAudioEncryptionKey();
    expect(key.length).toBe(32);
  });
});

describe('InfraController createAudioToken playCount', () => {
  let session: StudentSession;
  let controller: InfraController;

  beforeEach(() => {
    session = {
      id: 'sess-1',
      examSession: { rules: { audio: { max_plays: 2 } } },
      answers: { audio_meta: { playCount: 0 } },
    } as unknown as StudentSession;

    controller = new InfraController(
      {} as never,
      {
        save: jest.fn().mockImplementation(async (s: StudentSession) => {
          session.answers = s.answers;
          return s;
        }),
      } as never,
      {} as never,
      {} as never,
    );
  });

  const req = () =>
    ({ studentSession: session }) as Request & { studentSession: StudentSession };

  it('rejects third token when max_plays=2 without streaming', async () => {
    await controller.createAudioToken('asset-1', req());
    await controller.createAudioToken('asset-1', req());
    await expect(controller.createAudioToken('asset-1', req())).rejects.toThrow(
      'Max plays exceeded',
    );
  });
});
