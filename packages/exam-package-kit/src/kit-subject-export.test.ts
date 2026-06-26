import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dryRunZip,
  exportAllSubjectsFromState,
  exportSubjectFromState,
  buildSubjectZipFilename,
  sliceStateForSubject,
  validateExportState,
} from './kit';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { BLUEPRINT_FIXTURES } from '@vnu/shared-types';

describe('per-subject ZIP export', () => {
  it('sliceStateForSubject assigns new packageId per export', async () => {
    const state: ExamPackageExportState = {
      manifest: {
        formatVersion: '1.2',
        packageId: 'test-pkg-001',
        examName: 'Test',
        createdAt: new Date().toISOString(),
        mediaManifest: [],
      },
      session: {
        name: 'Test',
        routingMode: 'fixed_combo',
        status: 'active',
        rules: {
          exam_type: 'TN_THPT_2025',
          subjects: [{ code: 'MATH', structureMode: 'default', ui_mode: 'vertical_focus' }],
        } as never,
      },
      subjects: [
        {
          code: 'MATH',
          nameVi: 'Toán',
          examDate: '2026-06-26',
          startTime: '07:30',
          endTime: '09:00',
          durationMin: 90,
          structureMode: 'default',
          ui_mode: 'vertical_focus',
        },
      ],
      students: [
        {
          fullName: 'HS A',
          studentCode: 'HS001',
          subjects: ['MATH'],
          className: '10A1',
          sbd: '100001',
          pin: '12345678',
        },
      ],
      credentials: [
        {
          studentCode: 'HS001',
          fullName: 'HS A',
          subjectCode: 'MATH',
          sbd: '100001',
          examAccount: '100001',
          pin: '12345678',
        },
      ],
      clusters: [],
      papers: {
        MATH: { ...BLUEPRINT_FIXTURES.MATH, title: 'Toán test' },
      },
      credentialsAssignedAt: new Date().toISOString(),
      credentialsPrintedAt: new Date().toISOString(),
    };

    const sliced = sliceStateForSubject(state, 'MATH');
    assert.notEqual(sliced.manifest.packageId, 'test-pkg-001');
    assert.match(sliced.manifest.packageId, /^[0-9a-f-]{36}$/i);
    assert.equal(sliced.manifest.exportScope, 'single_subject');
    assert.equal(sliced.manifest.subjectCode, 'MATH');
    assert.equal(sliced.subjects.length, 1);
    assert.equal(sliced.students[0].subjects.join(), 'MATH');

    const v = validateExportState(sliced, { subjectCode: 'MATH' });
    assert.equal(v.valid, true, v.errors.join('; '));

    const files = await exportAllSubjectsFromState(state);
    assert.equal(files.length, 1);
    assert.equal(files[0].subjectCode, 'MATH');
    assert.match(files[0].filename, /exam-.+-MATH-20260626-0730\.zip/);

    const drySubject = await dryRunZip(files[0].buffer);
    assert.equal(
      drySubject.passed,
      true,
      drySubject.checklist.map((c) => `${c.ok ? '✓' : '✗'} ${c.item}${c.detail ? `: ${c.detail}` : ''}`).join('; '),
    );
  });
});
