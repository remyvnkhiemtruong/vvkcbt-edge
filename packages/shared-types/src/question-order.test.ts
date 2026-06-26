import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichQuestionsWithPart,
  orderQuestionsByPart,
  seededShuffle,
} from './question-order';
import { getDefaultStructure, TN_THPT_SUBJECTS } from './tn-thpt-catalog';

describe('question-order', () => {
  it('seededShuffle is deterministic', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 'seed-a');
    const b = seededShuffle([1, 2, 3, 4, 5], 'seed-a');
    assert.deepEqual(a, b);
  });

  it('keeps part order and shuffles only within part', () => {
    const questions = [
      { id: 'p1a', part: 'part1_mcq' },
      { id: 'p1b', part: 'part1_mcq' },
      { id: 'p2a', part: 'part2_true_false' },
      { id: 'p2b', part: 'part2_true_false' },
      { id: 'p3a', part: 'part3_short' },
    ];
    const partOrder = ['part1_mcq', 'part2_true_false', 'part3_short'];
    const ordered = orderQuestionsByPart(questions, partOrder, 'student-1');

    const parts = ordered.map((q) => q.part);
    assert.deepEqual(parts, ['part1_mcq', 'part1_mcq', 'part2_true_false', 'part2_true_false', 'part3_short']);

    const p1Ids = ordered.filter((q) => q.part === 'part1_mcq').map((q) => q.id).sort();
    assert.deepEqual(p1Ids, ['p1a', 'p1b'].sort());
  });

  it('does not shuffle when shuffleWithinPart is false', () => {
    const questions = [
      { id: 'a', part: 'part1_mcq' },
      { id: 'b', part: 'part1_mcq' },
      { id: 'c', part: 'part2_true_false' },
    ];
    const ordered = orderQuestionsByPart(questions, ['part1_mcq', 'part2_true_false'], 'x', {
      shuffleWithinPart: false,
    });
    assert.deepEqual(
      ordered.map((q) => q.id),
      ['a', 'b', 'c'],
    );
  });

  it('enriches all TN_THPT subjects without crash', () => {
    for (const meta of TN_THPT_SUBJECTS) {
      const structure = getDefaultStructure(meta.code);
      assert.ok(structure, meta.code);
      const partOrder = Object.keys(structure!.parts);
      const questions = partOrder.map((part, i) => ({
        id: `${meta.code}-${i}`,
        type: structure!.parts[part].type,
        part,
      }));
      const ordered = orderQuestionsByPart(questions, partOrder, `seed-${meta.code}`, {
        shuffleWithinPart: structure!.shuffleWithinPart ?? true,
      });
      assert.equal(ordered.length, questions.length, meta.code);
    }
  });
});
