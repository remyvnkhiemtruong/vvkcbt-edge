import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StaffAuthService } from './staff-auth.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { StaffUserService } from './staff-user.service';

describe('StaffAuthService loginProctor', () => {
  const jwtSign = jest.fn().mockReturnValue('signed-token');
  const rateLimitCheck = jest.fn().mockResolvedValue(undefined);
  const validateLogin = jest.fn().mockResolvedValue(false);
  const validHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // hash of 'password'

  let configValues: Record<string, string | undefined>;
  let service: StaffAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues = {
      PROCTOR_PASSWORD_HASH: validHash,
    };
    service = new StaffAuthService(
      {
        get: (key: string) => configValues[key],
      } as unknown as ConfigService,
      { sign: jwtSign } as unknown as JwtService,
      { check: rateLimitCheck } as unknown as RateLimitService,
      { validateLogin } as unknown as StaffUserService,
    );
  });

  it('allows default proctor bypass when ALLOW_DEFAULT_PROCTOR=true (dev)', async () => {
    configValues.ALLOW_DEFAULT_PROCTOR = 'true';
    const result = await service.loginProctor('proctor', 'proctor123');
    expect(result.token).toBe('signed-token');
    expect(result.role).toBe('proctor');
  });

  it('rejects default proctor credentials when ALLOW_DEFAULT_PROCTOR is not set', async () => {
    await expect(service.loginProctor('proctor', 'proctor123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects default proctor credentials when ALLOW_DEFAULT_PROCTOR=false', async () => {
    configValues.ALLOW_DEFAULT_PROCTOR = 'false';
    await expect(service.loginProctor('proctor', 'proctor123')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
