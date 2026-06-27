import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultStructure, TN_THPT_SUBJECTS } from '@vnu/shared-types';
import {
  buildClusterRuns,
  buildExamParts,
  buildViewGroups,
  findPartIndex,
  findViewGroupIndex,
  getVisibleClusterRuns,
  shouldUseStemSplit,
} from './exam-clusters';
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

describe('shouldUseStemSplit', () => {
  it('enables horizontal stem split for true_false and short_answer in split_view', () => {
    const tf = buildClusterRuns(
      [{ id: '1', type: 'true_false', content: { stem: 'Đề', statements: ['a', 'b'] } }],
      0,
      0,
    )[0];
    const sa = buildClusterRuns(
      [{ id: '2', type: 'short_answer', content: { stem: 'Tính' } }],
      0,
      0,
    )[0];
    assert.equal(shouldUseStemSplit(tf, 'split_view'), true);
    assert.equal(shouldUseStemSplit(sa, 'split_view'), true);
    assert.equal(shouldUseStemSplit(tf, 'vertical_focus'), false);
  });

  it('does not stem-split English clusters (passage panel handles them)', () => {
    const run = buildClusterRuns(
      [
        {
          id: '1',
          type: 'cluster_mcq',
          clusterId: 'c1',
          content: { passage: 'Passage', stem: 'Q1', options: ['A. x'] },
        },
      ],
      0,
      0,
    )[0];
    assert.equal(shouldUseStemSplit(run, 'split_view'), false);
  });

  it('enables stem split for mcq in split_view', () => {
    const run = buildClusterRuns(
      [{ id: '1', type: 'mcq', content: { stem: 'Tính', options: ['A. 1', 'B. 2'] } }],
      0,
      0,
    )[0];
    assert.equal(shouldUseStemSplit(run, 'split_view'), true);
  });
});

describe('getVisibleClusterRuns', () => {
  const qs: ExamQuestion[] = [
    { id: '1', type: 'short_answer', content: { stem: 'Q17' } },
    { id: '2', type: 'short_answer', content: { stem: 'Q18' } },
    {
      id: '3',
      type: 'cluster_mcq',
      clusterId: 'en1',
      content: { passage: 'Passage', stem: 'Q19', options: ['A. x'] },
    },
    {
      id: '4',
      type: 'cluster_mcq',
      clusterId: 'en1',
      content: { passage: 'Passage', stem: 'Q20', options: ['A. y'] },
    },
  ];

  it('split_view shows only current solo question', () => {
    const runs = buildClusterRuns(qs, 0, 3);
    const visible = getVisibleClusterRuns(runs, 1, 'split_view');
    assert.equal(visible.length, 1);
    assert.equal(visible[0].questions.length, 1);
    assert.equal(visible[0].questions[0].globalIdx, 1);
  });

  it('split_view shows full English cluster when on any question in cluster', () => {
    const runs = buildClusterRuns(qs, 0, 3);
    const visible = getVisibleClusterRuns(runs, 3, 'split_view');
    assert.equal(visible.length, 1);
    assert.equal(visible[0].questions.length, 2);
  });

  it('vertical_focus shows all runs in part', () => {
    const runs = buildClusterRuns(qs, 0, 3);
    assert.equal(getVisibleClusterRuns(runs, 1, 'vertical_focus').length, runs.length);
  });
});

describe('buildViewGroups', () => {
  it('one group per non-cluster question', () => {
    const qs: ExamQuestion[] = [
      { id: '1', type: 'mcq', content: { stem: 'A' } },
      { id: '2', type: 'true_false', content: { stem: 'B', statements: ['s1', 's2', 's3', 's4'] } },
    ];
    const groups = buildViewGroups(qs);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].start, 0);
    assert.equal(groups[0].end, 0);
    assert.equal(groups[1].passage, 'B');
  });

  it('groups consecutive cluster_mcq by clusterId', () => {
    const qs: ExamQuestion[] = [
      { id: '1', type: 'cluster_mcq', clusterId: 'c1', content: { passage: 'P1', stem: 'Q1' } },
      { id: '2', type: 'cluster_mcq', clusterId: 'c1', content: { passage: 'P1', stem: 'Q2' } },
      { id: '3', type: 'cluster_mcq', clusterId: 'c2', content: { passage: 'P2', stem: 'Q3' } },
    ];
    const groups = buildViewGroups(qs);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].start, 0);
    assert.equal(groups[0].end, 1);
    assert.equal(groups[0].passage, 'P1');
    assert.equal(groups[1].start, 2);
    assert.equal(findViewGroupIndex(groups, 1), 0);
    assert.equal(findViewGroupIndex(groups, 2), 1);
  });
});
