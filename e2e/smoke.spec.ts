import { test, expect } from '@playwright/test';

test.describe('VNU LAN smoke', () => {
  test('API health responds', async ({ request }) => {
    const base = process.env.API_URL || 'http://localhost:3000';
    const res = await request.get(`${base}/api/infra/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBeDefined();
  });
});
