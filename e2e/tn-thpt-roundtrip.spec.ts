import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const API = process.env.API_URL || 'http://localhost:3000';

test.describe('TN THPT E2E — API round-trip', () => {
  test('API health', async ({ request }) => {
    const res = await request.get(`${API}/api/infra/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBeDefined();
  });

  test('dry-run template ZIP when fixture available', async ({ request }) => {
    const fixturePath =
      process.env.EXAM_PACKAGE_ZIP ||
      path.join(__dirname, 'fixtures', 'exam-package-11-mono.zip');
    if (!existsSync(fixturePath)) {
      test.skip();
      return;
    }
    const buf = readFileSync(fixturePath);
    const res = await request.post(`${API}/api/proctor/packages/dry-run`, {
      multipart: {
        file: {
          name: 'exam-package.zip',
          mimeType: 'application/zip',
          buffer: buf,
        },
      },
      headers: {
        Authorization: `Bearer ${process.env.PROCTOR_TOKEN || ''}`,
      },
    });
    if (res.status() === 401) {
      test.skip();
      return;
    }
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.passed).toBe(true);
  });
});
