import { describe, it, expect } from 'vitest';
import { buildVocab, recordVocab, vocabProgress, BOX_MAX } from '../../src/vocab/leitner';
import { VOCAB } from '../../src/data/vocab';
import { seeded } from '../../src/bank/build';

describe('vocab drill', () => {
  it('builds 12 items, one word per group', () => {
    const items = buildVocab({}, 12, seeded(3));
    expect(items).toHaveLength(12);
    expect(new Set(items.map(i => i.gi)).size).toBe(12);
    expect(items.every(i => VOCAB.groups[i.gi].w[i.wi] === i.word)).toBe(true);
  });
  it('mixes about a third new words in with review', () => {
    const vocab: Record<string, [number, number]> = {};
    VOCAB.groups.slice(0, 40).forEach(g => { vocab[g.w[0]] = [1, 1]; });
    const items = buildVocab(vocab, 12, seeded(5));
    expect(items.filter(i => !vocab[i.word])).toHaveLength(4);
  });
  it('a miss resets the box and BOX_MAX correct marks a word known', () => {
    let v: Record<string, [number, number]> = {};
    for (let i = 0; i < BOX_MAX; i++) v = recordVocab(v, 'w', true, i);
    expect(v.w[0]).toBe(BOX_MAX);
    expect(recordVocab(v, 'w', false, 9).w).toEqual([0, 9]);
  });
  it('reports progress over the distinct words', () => {
    const p = vocabProgress({ [VOCAB.groups[0].w[0]]: [BOX_MAX, 1], [VOCAB.groups[0].w[1]]: [1, 1] });
    expect(p).toEqual({ total: 322, seen: 2, known: 1 });
  });
});
