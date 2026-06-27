import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dryRunZip,
  exportSessionFromState,
  sliceStateForSession,
  validateSessionExport,
} from './kit';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { BLUEPRINT_FIXTURES } from '@vnu/shared-types';

function baseState(): ExamPackageExportState {
  const now = new Date().toISOString();
  return {
    manifest: {
      formatVersion: '1.2',
      packageId: 'session-pkg-001',
      examName: 'Ca thi song song',
      createdAt: now,
      mediaManifest: [],
    },
    session: {
      name: 'Ca thi',
      routingMode: 'fixed_combo',
      status: 'active',
      rules: {
        exam_type: 'TN_THPT_2025',
        subjects: [
          { code: 'MATH', structureMode: 'default', ui_mode: 'vertical_focus' },
          { code: 'PHYSICS', structureMode: 'default', ui_mode: 'vertical_focus' },
        ],
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
      {
        code: 'PHYSICS',
        nameVi: 'Vật lý',
        examDate: '2026-06-26',
        startTime: '07:30',
        endTime: '09:00',
        durationMin: 50,
        structureMode: 'default',
        ui_mode: 'vertical_focus',
      },
    ],
    students: [
      {
        fullName: 'HS Toán',
        studentCode: 'HS001',
        subjects: ['MATH'],
        className: '12A1',
        sbd: '120001',
        pin: '12345678',
      },
      {
        fullName: 'HS Lý',
        studentCode: 'HS002',
        subjects: ['PHYSICS'],
        className: '12A1',
        sbd: '120002',
        pin: '87654321',
      },
    ],
    credentials: [
      {
        studentCode: 'HS001',
        fullName: 'HS Toán',
        subjectCode: 'MATH',
        sbd: '120001',
        examAccount: '100001',
        pin: '12345678',
      },
      {
        studentCode: 'HS002',
        fullName: 'HS Lý',
        subjectCode: 'PHYSICS',
        sbd: '120002',
        examAccount: '100002',
        pin: '87654321',
      },
    ],
    clusters: [],
    papers: {
      MATH: { ...BLUEPRINT_FIXTURES.MATH, title: 'Toán' },
      PHYSICS: { ...BLUEPRINT_FIXTURES.PHYSICS, title: 'Lý' },
    },
    credentialsAssignedAt: now,
    credentialsPrintedAt: now,
  };
}

describe('session ZIP export (multi-subject same slot)', () => {
  it('sliceStateForSession keeps one packageId and full scope', () => {
    const state = baseState();
    const sliced = sliceStateForSession(state, ['MATH', 'PHYSICS']);
    assert.equal(sliced.manifest.exportScope, 'full');
    assert.equal(sliced.manifest.packageId, 'session-pkg-001');
    assert.equal(sliced.subjects.length, 2);
    assert.equal(Object.keys(sliced.papers).length, 2);
    assert.equal(sliced.students.length, 2);
  });

  it('validateSessionExport accepts shared-account credentials per student', () => {
    const state = baseState();
    const v = validateSessionExport(state, ['MATH', 'PHYSICS']);
    assert.equal(v.valid, true, v.errors.join('; '));
  });

  it('exportSessionFromState produces importable ZIP', async () => {
    const state = baseState();
    const buffer = await exportSessionFromState(state, ['MATH', 'PHYSICS']);
    const dry = await dryRunZip(buffer);
    assert.equal(dry.passed, true, dry.checklist.map((c) => c.item).join('; '));
  });
});
