import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  checkExtractedZipSizeLimit,
  extractZipSafe,
  getDirSizeBytes,
  MAX_EXTRACTED_BYTES,
} from './kit';

describe('extractZipSafe zip-bomb guard', () => {
  it('MAX_EXTRACTED_BYTES is 500MB', () => {
    assert.equal(MAX_EXTRACTED_BYTES, 500 * 1024 * 1024);
  });

  it('getDirSizeBytes sums file sizes recursively', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-size-'));
    try {
      fs.writeFileSync(path.join(dir, 'a.txt'), Buffer.alloc(100));
      const sub = path.join(dir, 'sub');
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, 'b.txt'), Buffer.alloc(50));
      assert.equal(getDirSizeBytes(dir), 150);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('checkExtractedZipSizeLimit throws when size exceeds 500MB', () => {
    assert.throws(
      () => checkExtractedZipSizeLimit(MAX_EXTRACTED_BYTES + 1),
      /zip-bomb|500MB/,
    );
  });

  it('extractZipSafe cleans up workDir on extract failure', async () => {
    const existing = new Set(
      fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('vnu-import-')),
    );
    await assert.rejects(() => extractZipSafe(Buffer.from('not-a-zip')));
    const leaked = fs
      .readdirSync(os.tmpdir())
      .filter((d) => d.startsWith('vnu-import-') && !existing.has(d));
    assert.equal(leaked.length, 0, `leaked dirs: ${leaked.join(', ')}`);
  });

  it('extractZipSafe accepts empty zip within size limit', async () => {
    const emptyZip = Buffer.from([
      0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const extractDir = await extractZipSafe(emptyZip);
    try {
      assert.ok(fs.existsSync(extractDir));
      assert.ok(getDirSizeBytes(extractDir) <= MAX_EXTRACTED_BYTES);
    } finally {
      fs.rmSync(path.dirname(extractDir), { recursive: true, force: true });
    }
  });
});
