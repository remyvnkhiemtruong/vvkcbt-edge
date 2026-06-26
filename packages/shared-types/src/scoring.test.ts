import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePartScores, compareShortAnswer, scoreAnswer } from './scoring';

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

});

describe('scoreAnswer', () => {
  it('scores short_answer with comma when rules is undefined', () => {
    const q = {
      id: 'q1',
      type: 'short_answer' as const,
      correctKey: '2.5',
      maxScore: 0.5,
      part: 'part3_short',
    };
    const withDot = scoreAnswer(q, '2.5');
    const withComma = scoreAnswer(q, '2,5');
    assert.equal(withDot.score, 0.5);
    assert.equal(withComma.score, 0.5);
  });

  it('handles null scoring rules without throwing', () => {
    const q = {
      id: 'q2',
      type: 'mcq' as const,
      correctKey: 'A',
      maxScore: 0.25,
    };
    const result = scoreAnswer(q, 'A', undefined);
    assert.equal(result.score, 0.25);
  });

  it('does not throw when true_false answer is missing', () => {
    const q = {
      id: 'q3',
      type: 'true_false' as const,
      correctKey: [true, false, true, false],
      maxScore: 1,
    };
    const result = scoreAnswer(q, undefined);
    assert.equal(result.score, 0);
  });
});

describe('compareShortAnswer', () => {
  it('treats comma and dot as equivalent', () => {
    assert.equal(compareShortAnswer('2,5', '2.5'), true);
    assert.equal(compareShortAnswer('2.5', '2,5'), true);
  });
});
