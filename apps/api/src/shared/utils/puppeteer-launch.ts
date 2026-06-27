import { existsSync } from 'fs';
import puppeteer, { type Browser } from 'puppeteer';

const WIN_BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

export function resolvePuppeteerExecutable(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  try {
    const bundled = puppeteer.executablePath();
    if (bundled && existsSync(bundled)) return bundled;
  } catch {
    /* bundled chromium not installed */
  }

  for (const candidate of WIN_BROWSER_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

export async function launchPdfBrowser(): Promise<Browser> {
  const executablePath = resolvePuppeteerExecutable();
  if (!executablePath) {
    throw new Error(
      'Không tìm thấy trình duyệt để xuất PDF. Cài Chrome/Edge hoặc đặt PUPPETEER_EXECUTABLE_PATH.',
    );
  }
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}
