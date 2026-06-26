import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultStructure, TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { buildExamParts, findPartIndex } from './exam-clusters';
import type { ExamQuestion } from '../components/ExamViewShell';

function makeQuestions(subjectCode: string): ExamQuestion[] {
  const structure = getDefaultStructure(subjectCode);
  if (!structure) return [];
  const partOrder = Object.keys(structure.parts);
  const rows: ExamQuestion[] = [];
  let n = 0;
  for (const partKey of partOrder) {
    const cfg = structure.parts[partKey];
    const count = cfg.count ?? (cfg.type === 'essay' ? 1 : 2);
    for (let i = 0; i < count; i++) {
      rows.push({
        id: `${subjectCode}-${n++}`,
        type: cfg.type,
        part: partKey,
        content: { stem: `Q${n}` },
      });
    }
  }
  return rows;
}

describe('buildExamParts', () => {
  it('groups contiguous questions by part', () => {
    const qs: ExamQuestion[] = [
      { id: '1', part: 'part1_mcq', content: {} },
      { id: '2', part: 'part1_mcq', content: {} },
      { id: '3', part: 'part2_true_false', content: {} },
    ];
    const parts = buildExamParts(qs, ['part1_mcq', 'part2_true_false']);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].start, 0);
    assert.equal(parts[0].end, 1);
    assert.equal(parts[1].start, 2);
    assert.equal(findPartIndex(parts, 2), 1);
  });

  for (const meta of TN_THPT_SUBJECTS) {
    it(`builds parts for ${meta.code}`, () => {
      const qs = makeQuestions(meta.code);
      const structure = getDefaultStructure(meta.code)!;
      const partOrder = Object.keys(structure.parts);
      const parts = buildExamParts(qs, partOrder);
      assert.equal(parts.length, partOrder.length, meta.code);
      const total = parts.reduce((s, p) => s + p.questionCount, 0);
      assert.equal(total, qs.length, meta.code);
    });
  }
});
