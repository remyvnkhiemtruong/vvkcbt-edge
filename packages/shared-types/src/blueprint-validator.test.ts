import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubjectBlueprint } from './blueprint-validator';
import {
  BLUEPRINT_FIXTURES,
  buildValidEnglishClusters,
} from './__fixtures__/blueprint-fixtures';
import { TN_THPT_SUBJECTS } from './tn-thpt-catalog';

describe('validateSubjectBlueprint — 11 môn TN THPT', () => {
  for (const meta of TN_THPT_SUBJECTS) {
    it(`passes valid fixture for ${meta.code} (${meta.nameVi})`, () => {
      const paper = BLUEPRINT_FIXTURES[meta.code];
      const clusters = meta.code === 'ENGLISH' ? buildValidEnglishClusters() : [];
      const result = validateSubjectBlueprint({
        subjectCode: meta.code,
        paper,
        clusters,
        mediaManifest: [],
      });
      assert.equal(
        result.valid,
        true,
        `${meta.code} errors: ${result.errors.join('; ')}`,
      );
    });
  }

  it('rejects MATH with wrong MCQ count', () => {
    const paper = { ...BLUEPRINT_FIXTURES.MATH, questions: BLUEPRINT_FIXTURES.MATH.questions.slice(0, 5) };
    const result = validateSubjectBlueprint({ subjectCode: 'MATH', paper });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('part1_mcq')));
  });

  it('rejects ENGLISH without clusters', () => {
    const result = validateSubjectBlueprint({
      subjectCode: 'ENGLISH',
      paper: BLUEPRINT_FIXTURES.ENGLISH,
      clusters: [],
    });
    assert.equal(result.valid, false);
  });
});
