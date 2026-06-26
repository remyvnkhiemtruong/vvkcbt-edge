import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubjectBlueprint } from './blueprint-validator';
import { BLUEPRINT_FIXTURES, buildValidEnglishClusters } from './__fixtures__/blueprint-fixtures';

describe('blueprint informatics slots', () => {
  it('warns when informaticsSlot missing on part II', () => {
    const paper = BLUEPRINT_FIXTURES.INFORMATICS;
    const r = validateSubjectBlueprint({ subjectCode: 'INFORMATICS', paper });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.includes('informaticsSlot')));
  });

  it('errors on duplicate informaticsSlot', () => {
    const paper = structuredClone(BLUEPRINT_FIXTURES.INFORMATICS);
    const qs = paper.questions.map((q) => {
      const row = q as { part?: string; informaticsSlot?: number };
      if (row.part === 'part2_true_false') {
        return { ...q, informaticsSlot: 1 };
      }
      return q;
    });
    const r = validateSubjectBlueprint({
      subjectCode: 'INFORMATICS',
      paper: { ...paper, questions: qs },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('trùng')));
  });
});

describe('rich content tokens', () => {
  it('accepts underline/bold tokens in question stem', () => {
    const paper = structuredClone(BLUEPRINT_FIXTURES.MATH);
    const q0 = paper.questions[0] as { content: Record<string, unknown> };
    q0.content = {
      ...q0.content,
      stem: '**Bold** and __underline__ with $x^2$',
      options: ['A. __opt__', 'B. 2', 'C. 3', 'D. 4'],
    };
    const r = validateSubjectBlueprint({ subjectCode: 'MATH', paper });
    assert.equal(r.valid, true);
  });

  it('validates English clusters with rich passage text', () => {
    const clusters = buildValidEnglishClusters();
    const richClusters = clusters.map((c) =>
      c.clusterSubtype === 'fill_notice'
        ? {
            ...c,
            passage: { text: '**SCHOOL NOTICE**\nRegister at {{1}} by __Friday__.' },
          }
        : c,
    );
    const r = validateSubjectBlueprint({
      subjectCode: 'ENGLISH',
      paper: BLUEPRINT_FIXTURES.ENGLISH,
      clusters: richClusters,
    });
    assert.equal(r.valid, true);
  });
});
