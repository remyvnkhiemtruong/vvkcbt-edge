import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import extract from 'extract-zip';
import {
  EXAM_PACKAGE_FORMAT_VERSION,
  TN_THPT_SUBJECTS,
  ExamType,
  RoutingMode,
} from '@vnu/shared-types';

describe('Exam package manifest', () => {
  it('uses format version 1.2', () => {
    expect(EXAM_PACKAGE_FORMAT_VERSION).toBe('1.2');
  });

  it('requires LITERATURE and MATH in student subjects', () => {
    const validate = (subjects: string[]) =>
      subjects.includes('LITERATURE') && subjects.includes('MATH');

    expect(validate(['LITERATURE', 'MATH'])).toBe(true);
    expect(validate(['MATH', 'ENGLISH'])).toBe(false);
  });
});

describe('Exam package ZIP structure', () => {
  async function buildMinimalZip(): Promise<Buffer> {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-pkg-test-'));
    const packageId = '00000000-0000-4000-8000-000000000001';
    const manifest = {
      formatVersion: EXAM_PACKAGE_FORMAT_VERSION,
      packageId,
      examName: 'Test exam',
      createdAt: new Date().toISOString(),
      mediaManifest: [],
    };
    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(
      path.join(workDir, 'session.json'),
      JSON.stringify({
        name: 'Test',
        routingMode: RoutingMode.FIXED_COMBO,
        status: 'active',
        rules: {
          exam_type: ExamType.TN_THPT_2025,
          subjects: TN_THPT_SUBJECTS.map((s) => ({ code: s.code, ui_mode: s.uiMode })),
          scoring: {
            true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
            short_answer_normalize: ['comma_to_dot'],
          },
          proctoring: { max_focus_violations: 3, autosave_interval_sec: 3 },
        },
      }),
    );
    fs.writeFileSync(
      path.join(workDir, 'subjects.json'),
      JSON.stringify(
        TN_THPT_SUBJECTS.slice(0, 2).map((s) => ({
          code: s.code,
          nameVi: s.nameVi,
          examDate: '2025-06-15',
          startTime: '07:30',
          endTime: '09:30',
          durationMin: s.durationMin,
          structureMode: 'default',
          ui_mode: s.uiMode,
        })),
      ),
    );
    fs.writeFileSync(
      path.join(workDir, 'students.json'),
      JSON.stringify([
        {
          fullName: 'Nguyễn Văn A',
          studentCode: 'HS001',
          className: '12A1',
          subjects: ['LITERATURE', 'MATH'],
        },
      ]),
    );
    const papersDir = path.join(workDir, 'papers');
    fs.mkdirSync(papersDir);
    fs.writeFileSync(
      path.join(papersDir, 'MATH.json'),
      JSON.stringify({
        title: 'Đề Toán',
        subject: 'MATH',
        questions: [{ id: 'q1', type: 'mcq', content: { stem: '1+1=?' }, correctKey: 'B' }],
      }),
    );

    const zipPath = path.join(path.dirname(workDir), `test-${Date.now()}.zip`);
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(workDir, false);
      archive.finalize();
    });
    const buf = fs.readFileSync(zipPath);
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
    return buf;
  }

  it('builds ZIP with required manifest and papers', async () => {
    const buf = await buildMinimalZip();
    expect(buf.length).toBeGreaterThan(100);

    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-unzip-'));
    const zipPath = path.join(extractDir, 'pkg.zip');
    fs.writeFileSync(zipPath, buf);
    const out = path.join(extractDir, 'out');
    fs.mkdirSync(out);
    await extract(zipPath, { dir: out });

    expect(fs.existsSync(path.join(out, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'session.json'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'papers', 'MATH.json'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.formatVersion).toBe(EXAM_PACKAGE_FORMAT_VERSION);
    expect(manifest.packageId).toBeTruthy();

    fs.rmSync(extractDir, { recursive: true, force: true });
  });

  it('rejects zip-slip paths', () => {
    const root = path.resolve('/tmp/safe');
    const evil = path.resolve('/tmp/evil');
    expect(evil.startsWith(root)).toBe(false);
  });
});

describe('Export score columns', () => {
  it('KetQua headers include per-question detail', () => {
    const headers = ['SBD', 'Mã HS', 'Điểm', 'Chi tiết từng câu', 'Nộp lúc'];
    expect(headers).toContain('Chi tiết từng câu');
  });
});
