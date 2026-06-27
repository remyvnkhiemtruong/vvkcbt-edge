import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichQuestionsWithPart,
  orderEnglishClusterQuestions,
  orderQuestionsByPart,
  orderQuestionsForExam,
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
      const ordered = orderQuestionsForExam(meta.code, questions, partOrder, `seed-${meta.code}`, {
        shuffleWithinPart: structure!.shuffleWithinPart ?? true,
      });
      assert.equal(ordered.length, questions.length, meta.code);
    }
  });

  it('orderEnglishClusterQuestions shuffles cluster blocks only', () => {
    const questions = [
      { id: 'n1', clusterId: 'c-notice', clusterOrder: 1, clusterSubtype: 'fill_notice' },
      { id: 'n2', clusterId: 'c-notice', clusterOrder: 2, clusterSubtype: 'fill_notice' },
      { id: 'r1', clusterId: 'c-read', clusterOrder: 1, clusterSubtype: 'reading_8' },
      { id: 'r2', clusterId: 'c-read', clusterOrder: 2, clusterSubtype: 'reading_8' },
    ];
    const ordered = orderEnglishClusterQuestions(questions, 'student-en');
    assert.equal(ordered.length, 4);
    const noticeIdx = ordered.map((q) => q.id).indexOf('n1');
    const readIdx = ordered.map((q) => q.id).indexOf('r1');
    assert.notEqual(noticeIdx, -1);
    assert.notEqual(readIdx, -1);
    assert.ok(
      (noticeIdx < readIdx && ordered[noticeIdx + 1]?.id === 'n2') ||
        (readIdx < noticeIdx && ordered[readIdx + 1]?.id === 'r2'),
    );
    const noticeBlock = ordered.filter((q) => q.clusterId === 'c-notice').map((q) => q.id);
    assert.deepEqual(noticeBlock, ['n1', 'n2']);
    const readBlock = ordered.filter((q) => q.clusterId === 'c-read').map((q) => q.id);
    assert.deepEqual(readBlock, ['r1', 'r2']);
  });

  it('orderEnglishClusterQuestions shuffles questions in reorder cluster only', () => {
    const questions = [
      { id: 'o1', clusterId: 'c-reorder', clusterOrder: 1, clusterSubtype: 'reorder' },
      { id: 'o2', clusterId: 'c-reorder', clusterOrder: 2, clusterSubtype: 'reorder' },
      { id: 'o3', clusterId: 'c-reorder', clusterOrder: 3, clusterSubtype: 'reorder' },
      { id: 'g1', clusterId: 'c-gap', clusterOrder: 1, clusterSubtype: 'fill_gap' },
      { id: 'g2', clusterId: 'c-gap', clusterOrder: 2, clusterSubtype: 'fill_gap' },
    ];
    const ordered = orderEnglishClusterQuestions(questions, 'seed-reorder');
    const reorderIds = ordered.filter((q) => q.clusterId === 'c-reorder').map((q) => q.id);
    const gapIds = ordered.filter((q) => q.clusterId === 'c-gap').map((q) => q.id);
    assert.deepEqual(new Set(reorderIds), new Set(['o1', 'o2', 'o3']));
    assert.deepEqual(gapIds, ['g1', 'g2']);
    assert.notDeepEqual(reorderIds, ['o1', 'o2', 'o3']);
  });

  it('orderQuestionsForExam uses English cluster rules for ENGLISH', () => {
    const questions = [
      { id: 'a', clusterId: 'c1', clusterOrder: 1, clusterSubtype: 'reading_8' },
      { id: 'b', clusterId: 'c2', clusterOrder: 1, clusterSubtype: 'reading_10' },
    ];
    const a = orderQuestionsForExam('ENGLISH', questions, ['part1_cluster_mcq'], 'x');
    const b = orderQuestionsForExam('ENGLISH', questions, ['part1_cluster_mcq'], 'x');
    assert.deepEqual(a, b);
    assert.deepEqual(new Set(a.map((q) => q.id)), new Set(['a', 'b']));
  });
});
