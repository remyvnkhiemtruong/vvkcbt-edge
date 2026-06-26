import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePartScores } from './scoring';

describe('aggregatePartScores', () => {
  it('aggregates math 3-part scores', () => {
    const questions = [
      { id: 'q1', part: 'part1_mcq', maxScore: 0.25 },
      { id: 'q2', part: 'part2_true_false', maxScore: 1 },
      { id: 'q3', part: 'part3_short', maxScore: 0.5 },
    ];
    const breakdown = [
      { questionId: 'q1', score: 0.25, maxScore: 0.25 },
      { questionId: 'q2', score: 0.5, maxScore: 1 },
      { questionId: 'q3', score: 0, maxScore: 0.5 },
    ];
    const parts = aggregatePartScores(questions, breakdown);
    assert.equal(parts.part1, 0.25);
    assert.equal(parts.part2, 0.5);
    assert.equal(parts.part3, 0);
    assert.equal(parts.maxPart1, 0.25);
    assert.equal(parts.maxPart2, 1);
    assert.equal(parts.maxPart3, 0.5);
  });

  it('maps literature essay parts to part1/part2', () => {
    const questions = [
      { id: 'v1', part: 'part1_reading', maxScore: 3 },
      { id: 'v2', part: 'part2_writing', maxScore: 7 },
    ];
    const breakdown = [
      { questionId: 'v1', score: 0, maxScore: 3 },
      { questionId: 'v2', score: 0, maxScore: 7 },
    ];
    const parts = aggregatePartScores(questions, breakdown);
    assert.equal(parts.part1, 0);
    assert.equal(parts.part2, 0);
    assert.equal(parts.maxPart1, 3);
    assert.equal(parts.maxPart2, 7);
  });
});
