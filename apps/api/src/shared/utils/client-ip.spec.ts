import { getClientIpFromRequest } from './client-ip';

describe('getClientIpFromRequest', () => {
  it('ignores spoofed X-Forwarded-For and uses req.ip', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      ip: '192.168.1.100',
      socket: { remoteAddress: '127.0.0.1' },
    } as never;

    expect(getClientIpFromRequest(req)).toBe('192.168.1.100');
  });

  it('falls back to socket remoteAddress when req.ip is empty', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4' },
      ip: undefined,
      socket: { remoteAddress: '10.0.0.5' },
    } as never;

    expect(getClientIpFromRequest(req)).toBe('10.0.0.5');
  });
});
