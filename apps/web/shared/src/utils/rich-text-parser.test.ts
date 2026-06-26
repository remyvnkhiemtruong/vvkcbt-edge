import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitPassageGaps } from './rich-text-parser';

describe('splitPassageGaps', () => {
  it('splits {{n}} markers', () => {
    const segs = splitPassageGaps('Hello {{1}} world {{2}}!');
    assert.equal(segs.filter((s) => s.kind === 'gap').length, 2);
    assert.deepEqual(segs[0], { kind: 'text', value: 'Hello ' });
    assert.deepEqual(segs[1], { kind: 'gap', value: '{{1}}', gapIndex: 0 });
  });

  it('splits ___ markers', () => {
    const segs = splitPassageGaps('Fill ___ here');
    assert.deepEqual(segs[1], { kind: 'gap', value: '___', gapIndex: 0 });
  });

  it('does not split gaps inside fenced code', () => {
    const text = 'Before\n```python\nx = {{1}}\n```\nAfter {{1}}';
    const segs = splitPassageGaps(text);
    const gaps = segs.filter((s) => s.kind === 'gap');
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].value, '{{1}}');
    assert.ok(segs.some((s) => s.kind === 'text' && s.value.includes('```python')));
  });
});
