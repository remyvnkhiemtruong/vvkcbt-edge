import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateExportState, MANDATORY_PAPER_CODES } from './kit';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { BLUEPRINT_FIXTURES } from '@vnu/shared-types';

function baseFullState(): ExamPackageExportState {
  const now = new Date().toISOString();
  return {
    manifest: {
      formatVersion: '1.2',
      packageId: 'full-pkg-001',
      examName: 'Full export',
      createdAt: now,
      mediaManifest: [],
    },
    session: {
      name: 'Ca thi',
      routingMode: 'fixed_combo',
      status: 'active',
      rules: {
        exam_type: 'TN_THPT_2025',
        subjects: [{ code: 'MATH', structureMode: 'default', ui_mode: 'vertical_focus' }],
      } as never,
    },
    subjects: [],
    students: [
      {
        fullName: 'HS A',
        studentCode: 'HS001',
        subjects: ['MATH'],
        className: '12A1',
        sbd: '120001',
        pin: '12345678',
      },
    ],
    credentials: [
      {
        studentCode: 'HS001',
        fullName: 'HS A',
        subjectCode: 'MATH',
        sbd: '120001',
        examAccount: '100001',
        pin: '12345678',
      },
    ],
    clusters: [],
    papers: {
      MATH: { ...BLUEPRINT_FIXTURES.MATH, title: 'Toán test' },
    },
    credentialsAssignedAt: now,
    credentialsPrintedAt: now,
  };
}

describe('LITERATURE mandatory validation', () => {
  it('MANDATORY_PAPER_CODES includes LITERATURE and MATH', () => {
    assert.deepEqual(MANDATORY_PAPER_CODES, ['LITERATURE', 'MATH']);
  });

  it('full export fails when LITERATURE paper is missing', () => {
    const v = validateExportState(baseFullState());
    assert.equal(v.valid, false);
    assert.ok(
      v.errors.some((e) => e.includes('LITERATURE')),
      v.errors.join('; '),
    );
  });

  it('full export accepts both mandatory papers present', () => {
    const state = baseFullState();
    state.papers = {
      ...state.papers,
      LITERATURE: {
        subject: 'LITERATURE',
        title: 'Ngữ văn test',
        questions: [
          {
            id: 'V1',
            subject: 'LITERATURE',
            type: 'mcq',
            part: 'part1',
            difficulty: 'medium',
            content: { stem: 'Câu 1', options: ['A', 'B', 'C', 'D'] },
            correctKey: 'A',
            maxScore: 0.25,
          },
        ],
      },
    };
    const v = validateExportState(state);
    const mandatoryMissing = v.errors.filter((e) => e.includes('Môn bắt buộc LITERATURE'));
    assert.equal(mandatoryMissing.length, 0, mandatoryMissing.join('; '));
  });
});
