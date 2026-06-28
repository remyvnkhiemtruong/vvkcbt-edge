import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { StudentAuthService } from './student-auth.service';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service';

describe('StudentAuthService login rate limit', () => {
  const rateLimitCheck = jest.fn();
  let callCount = 0;

  const service = new StudentAuthService(
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    { get: jest.fn() } as never,
    {} as never,
    {} as never,
    {
      check: (...args: unknown[]) => {
        rateLimitCheck(...args);
        callCount += 1;
        if (callCount > 5) throw new Error('RATE_LIMIT');
        return Promise.resolve();
      },
    } as unknown as RateLimitService,
  );

  beforeEach(() => {
    callCount = 0;
    rateLimitCheck.mockClear();
  });

  it('throws 429 after 5 login attempts for the same account', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(service.login('student-a', 'wrong', 'exam-1', '127.0.0.1')).rejects.toThrow(
        UnauthorizedException,
      );
    }
    await expect(service.login('student-a', 'wrong', 'exam-1', '127.0.0.1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Quá nhiều lần đăng nhập',
    });
    expect(rateLimitCheck).toHaveBeenCalledWith('student:student-a', 5, 60);
  });

  it('uses trimmed account key and does not block other accounts', async () => {
    callCount = 5;
    await expect(service.login(' student-a ', 'wrong', 'exam-1', '127.0.0.1')).rejects.toBeInstanceOf(
      HttpException,
    );

    callCount = 0;
    await expect(service.login('student-b', 'wrong', 'exam-1', '127.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(rateLimitCheck).toHaveBeenLastCalledWith('student:student-b', 5, 60);
  });
});
