import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORT_ANSWER_MAX_LEN,
  filterShortAnswerInput,
  isValidShortAnswer,
} from './short-answer';

describe('filterShortAnswerInput', () => {
  it('keeps max 4 characters', () => {
    assert.equal(filterShortAnswerInput('12345'), '1234');
    assert.equal(filterShortAnswerInput('-1234'), '-123');
  });

  it('allows comma or dot decimal separator', () => {
    assert.equal(filterShortAnswerInput('2,5'), '2,5');
    assert.equal(filterShortAnswerInput('2.5'), '2.5');
    assert.equal(filterShortAnswerInput('-2,5'), '-2,5');
  });

  it('strips invalid characters', () => {
    assert.equal(filterShortAnswerInput('a-1b2c'), '-12');
    assert.equal(filterShortAnswerInput('  12  '), '12');
  });

  it('keeps only one decimal separator', () => {
    assert.equal(filterShortAnswerInput('1.2.3'), '1.23');
    assert.equal(filterShortAnswerInput('1,2,3'), '1,23');
  });
});

describe('isValidShortAnswer', () => {
  it('accepts integers and decimals, positive and negative', () => {
    assert.equal(isValidShortAnswer('7'), true);
    assert.equal(isValidShortAnswer('1234'), true);
    assert.equal(isValidShortAnswer('-1'), true);
    assert.equal(isValidShortAnswer('-123'), true);
    assert.equal(isValidShortAnswer('2.5'), true);
    assert.equal(isValidShortAnswer('2,5'), true);
    assert.equal(isValidShortAnswer('12.3'), true);
    assert.equal(isValidShortAnswer('-2.5'), true);
    assert.equal(isValidShortAnswer('-0,5'), true);
  });

  it('rejects incomplete, too long, or invalid forms', () => {
    assert.equal(isValidShortAnswer(''), false);
    assert.equal(isValidShortAnswer('-'), false);
    assert.equal(isValidShortAnswer('2.'), false);
    assert.equal(isValidShortAnswer('.5'), false);
    assert.equal(isValidShortAnswer('12.34'), false);
    assert.equal(isValidShortAnswer('-1234'), false);
    assert.equal(isValidShortAnswer('abc'), false);
    assert.equal(isValidShortAnswer('1-2'), false);
  });

  it('enforces max length constant', () => {
    assert.equal(SHORT_ANSWER_MAX_LEN, 4);
  });
});
