import { describe, it, expect } from 'vitest';
import { GRIDINS } from '../../src/data/gridins';
import { VOCAB } from '../../src/data/vocab';

describe('shipped data', () => {
  it('has every grid-in id from ModuleDrill', () => {
    expect(GRIDINS.length).toBe(381);
    expect(GRIDINS.every(id => /^[0-9a-f]{8}$/.test(id))).toBe(true);
  });
  it('has four words and four definitions per vocab group', () => {
    for (const g of VOCAB.groups) {
      expect(g.w.length).toBe(4);
      expect(g.d.length).toBe(4);
    }
  });
  it('matches the vocab size ModuleDrill documents', () => {
    expect(VOCAB.groups.length).toBe(83);
    expect(new Set(VOCAB.groups.flatMap(g => g.w)).size).toBe(322);
  });
});
