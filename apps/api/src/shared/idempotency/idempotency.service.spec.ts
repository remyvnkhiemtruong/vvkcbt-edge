import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  it('fingerprint is stable for same body', () => {
    const body = { answers: { q1: 'A' } };
    const a = IdempotencyService.fingerprint(body);
    const b = IdempotencyService.fingerprint(body);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('fingerprint differs for different body', () => {
    const a = IdempotencyService.fingerprint({ answers: { q1: 'A' } });
    const b = IdempotencyService.fingerprint({ answers: { q1: 'B' } });
    expect(a).not.toBe(b);
  });
});
