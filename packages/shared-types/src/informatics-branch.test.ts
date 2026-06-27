import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInformaticsBranchScoring,
  resolveInformaticsBranch,
  resolveInformaticsBranchFromAnswers,
  shouldScoreInformaticsOptionalSlot,
} from './informatics-branch';
import { scoreExamPaper } from './scoring';

const tf = (id: string, slot: number) => ({
  id,
  type: 'true_false' as const,
  part: 'part2_true_false',
  informaticsSlot: slot,
  correctKey: [true, false, true, false],
  maxScore: 1,
});

const part2 = [tf('q1', 1), tf('q2', 2), tf('q3', 3), tf('q4', 4), tf('q5', 5), tf('q6', 6)];

function slotsRecord(active: number[]): Record<1 | 2 | 3 | 4 | 5 | 6, boolean> {
  return {
    1: active.includes(1),
    2: active.includes(2),
    3: active.includes(3),
    4: active.includes(4),
    5: active.includes(5),
    6: active.includes(6),
  };
}

function answersFromSlots(active: number[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const s of active) {
    map[`q${s}`] = [true, false, true, false];
  }
  return map;
}

function breakdownFor(active: number[]) {
  return part2.map((q) => ({
    questionId: q.id,
    score: active.includes(q.informaticsSlot) ? 1 : 0,
    maxScore: q.maxScore,
  }));
}

describe('resolveInformaticsBranch — common_only', () => {
  for (const active of [[], [1], [2], [1, 2]] as number[][]) {
    it(`common_only when optional empty: slots ${active.join(',') || 'none'}`, () => {
      assert.equal(resolveInformaticsBranch(slotsRecord(active)), 'common_only');
    });
  }
});

describe('resolveInformaticsBranch — khmt', () => {
  for (const optional of [[3], [4], [3, 4]] as number[][]) {
    it(`khmt when optional ${optional.join('+')} without THUD`, () => {
      assert.equal(resolveInformaticsBranch(slotsRecord([1, 2, ...optional])), 'khmt');
      assert.equal(resolveInformaticsBranch(slotsRecord(optional)), 'khmt');
    });
  }
});

describe('resolveInformaticsBranch — thud', () => {
  for (const optional of [[5], [6], [5, 6]] as number[][]) {
    it(`thud when optional ${optional.join('+')} without KHMT`, () => {
      assert.equal(resolveInformaticsBranch(slotsRecord([1, 2, ...optional])), 'thud');
      assert.equal(resolveInformaticsBranch(slotsRecord(optional)), 'thud');
    });
  }
});

describe('resolveInformaticsBranch — invalid_optional (lẫn nhánh)', () => {
  const invalidOptionalSets: number[][] = [
    [3, 5],
    [3, 6],
    [4, 5],
    [4, 6],
    [3, 4, 5],
    [3, 4, 6],
    [3, 5, 6],
    [4, 5, 6],
    [3, 4, 5, 6],
  ];

  for (const optional of invalidOptionalSets) {
    it(`invalid when optional ${optional.join('+')}`, () => {
      assert.equal(resolveInformaticsBranch(slotsRecord(optional)), 'invalid_optional');
      assert.equal(resolveInformaticsBranch(slotsRecord([1, 2, ...optional])), 'invalid_optional');
    });
  }
});

describe('shouldScoreInformaticsOptionalSlot', () => {
  it('common_only: no optional scored', () => {
    for (const slot of [3, 4, 5, 6] as const) {
      assert.equal(shouldScoreInformaticsOptionalSlot(slot, 'common_only'), false);
    }
  });

  it('khmt: only 3 and 4', () => {
    assert.equal(shouldScoreInformaticsOptionalSlot(3, 'khmt'), true);
    assert.equal(shouldScoreInformaticsOptionalSlot(4, 'khmt'), true);
    assert.equal(shouldScoreInformaticsOptionalSlot(5, 'khmt'), false);
    assert.equal(shouldScoreInformaticsOptionalSlot(6, 'khmt'), false);
  });

  it('thud: only 5 and 6', () => {
    assert.equal(shouldScoreInformaticsOptionalSlot(5, 'thud'), true);
    assert.equal(shouldScoreInformaticsOptionalSlot(6, 'thud'), true);
    assert.equal(shouldScoreInformaticsOptionalSlot(3, 'thud'), false);
    assert.equal(shouldScoreInformaticsOptionalSlot(4, 'thud'), false);
  });

  it('invalid_optional: no optional scored', () => {
    for (const slot of [3, 4, 5, 6] as const) {
      assert.equal(shouldScoreInformaticsOptionalSlot(slot, 'invalid_optional'), false);
    }
  });
});

describe('applyInformaticsBranchScoring — chấm theo nhánh', () => {
  function expectOptionalScores(
    active: number[],
    expected: Record<number, { score: number; maxScore: number }>,
    branchInvalid = false,
  ) {
    const { breakdown: out, branchInvalid: invalid } = applyInformaticsBranchScoring(
      part2,
      breakdownFor(active),
      answersFromSlots(active),
    );
    assert.equal(invalid, branchInvalid);
    for (const [slotStr, exp] of Object.entries(expected)) {
      const slot = Number(slotStr);
      const row = out.find((b) => b.questionId === `q${slot}`);
      assert.equal(row?.score, exp.score, `q${slot} score`);
      assert.equal(row?.maxScore, exp.maxScore, `q${slot} maxScore`);
    }
  }

  it('common_only: optional không chấm', () => {
    expectOptionalScores([1, 2], {
      3: { score: 0, maxScore: 0 },
      4: { score: 0, maxScore: 0 },
      5: { score: 0, maxScore: 0 },
      6: { score: 0, maxScore: 0 },
    });
  });

  it('khmt: chấm 3–4, không chấm 5–6', () => {
    expectOptionalScores([1, 2, 3, 4], {
      3: { score: 1, maxScore: 1 },
      4: { score: 1, maxScore: 1 },
      5: { score: 0, maxScore: 0 },
      6: { score: 0, maxScore: 0 },
    });
    expectOptionalScores([3], {
      3: { score: 1, maxScore: 1 },
      4: { score: 0, maxScore: 1 },
      5: { score: 0, maxScore: 0 },
      6: { score: 0, maxScore: 0 },
    });
  });

  it('thud: chấm 5–6, không chấm 3–4', () => {
    expectOptionalScores([1, 5, 6], {
      3: { score: 0, maxScore: 0 },
      4: { score: 0, maxScore: 0 },
      5: { score: 1, maxScore: 1 },
      6: { score: 1, maxScore: 1 },
    });
  });

  it('invalid 3+5: chỉ chấm 1–2, bỏ 3–6', () => {
    expectOptionalScores(
      [1, 2, 3, 5],
      {
        1: { score: 1, maxScore: 1 },
        2: { score: 1, maxScore: 1 },
        3: { score: 0, maxScore: 0 },
        5: { score: 0, maxScore: 0 },
      },
      true,
    );
  });

  it('invalid 3+4+5+6: chỉ chấm 1–2', () => {
    expectOptionalScores(
      [1, 2, 3, 4, 5, 6],
      {
        1: { score: 1, maxScore: 1 },
        2: { score: 1, maxScore: 1 },
        3: { score: 0, maxScore: 0 },
        4: { score: 0, maxScore: 0 },
        5: { score: 0, maxScore: 0 },
        6: { score: 0, maxScore: 0 },
      },
      true,
    );
  });

  for (const optional of [
    [3, 5],
    [3, 6],
    [4, 5],
    [4, 6],
    [3, 4, 5],
    [3, 4, 6],
    [3, 5, 6],
    [4, 5, 6],
  ]) {
    it(`invalid ${optional.join('+')}: optional không chấm`, () => {
      const { breakdown: out, branchInvalid } = applyInformaticsBranchScoring(
        part2,
        breakdownFor(optional),
        answersFromSlots(optional),
      );
      assert.equal(branchInvalid, true);
      for (const slot of [3, 4, 5, 6]) {
        const row = out.find((b) => b.questionId === `q${slot}`);
        assert.equal(row?.score, 0);
        assert.equal(row?.maxScore, 0);
      }
    });
  }
});

describe('scoreExamPaper — Tin học không tự xóa, chấm theo nhánh', () => {
  const questions = part2;

  it('invalid branch: informaticsBranchInvalid và optional = 0', () => {
    const answers = answersFromSlots([1, 2, 3, 5]);
    const result = scoreExamPaper(questions, answers, undefined, { subjectCode: 'INFORMATICS' });
    assert.equal(result.informaticsBranchInvalid, true);
    assert.equal(result.total, 2);
    assert.equal(result.breakdown.find((b) => b.questionId === 'q3')?.maxScore, 0);
    assert.equal(result.breakdown.find((b) => b.questionId === 'q5')?.maxScore, 0);
  });

  it('valid khmt: chấm 3–4', () => {
    const answers = answersFromSlots([3, 4]);
    const result = scoreExamPaper(questions, answers, undefined, { subjectCode: 'INFORMATICS' });
    assert.equal(result.informaticsBranchInvalid, undefined);
    assert.equal(result.total, 2);
  });
});

describe('resolveInformaticsBranchFromAnswers', () => {
  const optionalPart2 = [tf('q3', 3), tf('q4', 4), tf('q5', 5), tf('q6', 6)];

  it('detects thud from answers', () => {
    assert.equal(
      resolveInformaticsBranchFromAnswers(optionalPart2, answersFromSlots([5, 6])),
      'thud',
    );
  });

  it('detects invalid when both branches present in saved answers', () => {
    assert.equal(
      resolveInformaticsBranchFromAnswers(optionalPart2, answersFromSlots([3, 5])),
      'invalid_optional',
    );
  });
});
