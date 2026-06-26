import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInformaticsBranchScoring,
  patchInformaticsAnswers,
  resolveInformaticsBranch,
  resolveInformaticsBranchFromAnswers,
} from './informatics-branch';

const tf = (id: string, slot: number) => ({
  id,
  type: 'true_false' as const,
  part: 'part2_true_false',
  informaticsSlot: slot,
  correctKey: [true, false, true, false],
  maxScore: 4 / 6,
});

describe('resolveInformaticsBranch', () => {
  it('accepts KHMT track 3+4 only', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: true, 2: true, 3: true, 4: true, 5: false, 6: false }),
      'khmt',
    );
  });

  it('accepts THUD track 5+6 only', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: true, 2: false, 3: false, 4: false, 5: true, 6: true }),
      'thud',
    );
  });

  it('rejects mixed 3+5', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: true, 2: true, 3: true, 4: false, 5: true, 6: false }),
      'invalid_optional',
    );
  });

  it('rejects mixed 4+6', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: false, 2: false, 3: false, 4: true, 5: false, 6: true }),
      'invalid_optional',
    );
  });

  it('rejects all four optional questions', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: false, 2: false, 3: true, 4: true, 5: true, 6: true }),
      'invalid_optional',
    );
  });

  it('allows only common 1+2', () => {
    assert.equal(
      resolveInformaticsBranch({ 1: true, 2: true, 3: false, 4: false, 5: false, 6: false }),
      'common_only',
    );
  });
});

describe('applyInformaticsBranchScoring', () => {
  const part2 = [tf('q1', 1), tf('q2', 2), tf('q3', 3), tf('q4', 4), tf('q5', 5), tf('q6', 6)];
  const breakdown = part2.map((q) => ({
    questionId: q.id,
    score: 1,
    maxScore: q.maxScore,
  }));

  it('zeros optional questions when branch invalid', () => {
    const answers = {
      q1: [true, false, true, false],
      q2: [true, false, true, false],
      q3: [true, false, true, false],
      q5: [true, false, true, false],
    };
    const { breakdown: out, branchInvalid } = applyInformaticsBranchScoring(
      part2,
      breakdown,
      answers,
    );
    assert.equal(branchInvalid, true);
    assert.equal(out.find((b) => b.questionId === 'q1')?.score, 1);
    assert.equal(out.find((b) => b.questionId === 'q3')?.score, 0);
    assert.equal(out.find((b) => b.questionId === 'q5')?.score, 0);
  });

  it('keeps KHMT scores when 3+4 chosen', () => {
    const answers = {
      q1: [true, false, true, false],
      q3: [true, false, true, false],
      q4: [true, false, true, false],
    };
    const { breakdown: out, branchInvalid } = applyInformaticsBranchScoring(
      part2,
      breakdown,
      answers,
    );
    assert.equal(branchInvalid, false);
    assert.equal(out.find((b) => b.questionId === 'q3')?.score, 1);
    assert.equal(out.find((b) => b.questionId === 'q4')?.score, 1);
    assert.equal(out.find((b) => b.questionId === 'q5')?.score, 0);
  });
});

describe('patchInformaticsAnswers', () => {
  const part2 = [tf('q1', 1), tf('q3', 3), tf('q4', 4), tf('q5', 5), tf('q6', 6)];

  it('clears THUD when answering KHMT', () => {
    const answers = {
      q5: [true, false, true, false],
      q6: [false, true, false, true],
    };
    const patch = patchInformaticsAnswers(
      part2,
      answers,
      'q3',
      [true, false, true, false],
      'INFORMATICS',
    );
    assert.ok(patch.q3);
    assert.equal(patch.q5, undefined);
    assert.equal(patch.q6, undefined);
  });
});

describe('resolveInformaticsBranchFromAnswers', () => {
  const part2 = [tf('q3', 3), tf('q4', 4), tf('q5', 5), tf('q6', 6)];

  it('detects branch from answer map', () => {
    assert.equal(
      resolveInformaticsBranchFromAnswers(part2, {
        q5: [true, false, true, false],
        q6: [true, false, true, false],
      }),
      'thud',
    );
  });
});
