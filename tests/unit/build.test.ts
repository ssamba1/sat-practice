import { describe, it, expect } from 'vitest';
import type { Meta, Index, Diff } from '../../src/api/questions';
import { pool, draw, buildModule, buildCustom, skillsByDomain, routeModule2, seeded } from '../../src/bank/build';
import { MIX, SKILL_ORDER } from '../../src/bank/spec';

const DIFFS: Diff[] = ['E', 'M', 'H'];
const RW_SKILLS: Record<string, string[]> = {
  CAS: ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  INI: ['Central Ideas and Details', 'Command of Evidence', 'Inferences'],
  SEC: ['Boundaries', 'Form, Structure, and Sense'],
  EOI: ['Transitions', 'Rhetorical Synthesis'],
};
function makeIndex(): Index {
  const rw: Meta[] = [], math: Meta[] = [];
  for (let i = 0; i < 400; i++) {
    const dom = ['CAS', 'INI', 'SEC', 'EOI'][i % 4];
    const sk = RW_SKILLS[dom];
    rw.push({ id: 'r' + i, ext: 'er' + i, dom, domName: dom, skill: sk[(i >> 2) % sk.length], diff: DIFFS[i % 3], live: (i % 5 === 0 ? 1 : 0), type: 'mcq' });
    const mdom = ['H', 'P', 'Q', 'S'][i % 4];
    math.push({ id: 'm' + i, ext: 'em' + i, dom: mdom, domName: mdom, skill: 'skill ' + (i % 3), diff: DIFFS[(i >> 2) % 3], live: 0, type: i % 3 === 0 ? 'spr' : 'mcq' });
  }
  return { rw, math };
}
const opts = (seen: string[] = []) => ({ noActive: true, seen: new Set(seen), rng: seeded(7) });
const counts = (qs: Meta[]) => qs.reduce((c, q) => (c[q.dom] = (c[q.dom] || 0) + 1, c), {} as Record<string, number>);

describe('buildModule', () => {
  const idx = makeIndex();
  it('builds a 27-question rw module on the blueprint, in domain and skill order', () => {
    const { qs, short } = buildModule(idx, 'rw', MIX.m1, opts());
    expect(short).toBe(false);
    expect(qs).toHaveLength(27);
    expect(counts(qs)).toEqual({ CAS: 7, INI: 6, SEC: 8, EOI: 6 });
    const doms = qs.map(q => q.dom);
    expect(doms).toEqual([...Array(7).fill('CAS'), ...Array(6).fill('INI'), ...Array(8).fill('SEC'), ...Array(6).fill('EOI')]);
    for (const dom of ['CAS', 'INI', 'EOI']) {
      const ranks = qs.filter(q => q.dom === dom).map(q => SKILL_ORDER[dom].indexOf(q.skill.toLowerCase()));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
  it('builds a 22-question math module with 6 grid-ins placed last', () => {
    const { qs } = buildModule(idx, 'math', MIX.m1, opts());
    expect(qs).toHaveLength(22);
    expect(counts(qs)).toEqual({ H: 7, P: 7, Q: 4, S: 4 });
    expect(qs.filter(q => q.type === 'spr')).toHaveLength(6);
    expect(qs.slice(16).every(q => q.type === 'spr')).toBe(true);
  });
  it('never repeats a question and excludes active items', () => {
    const { qs } = buildModule(idx, 'rw', MIX.m1, opts());
    expect(new Set(qs.map(q => q.id)).size).toBe(27);
    expect(qs.some(q => q.live)).toBe(false);
  });
  it('prefers unseen questions', () => {
    const seen = idx.rw.filter(q => q.dom === 'CAS' && !q.live).slice(0, 10).map(q => q.id);
    const { qs } = buildModule(idx, 'rw', MIX.m1, opts(seen));
    expect(qs.some(q => seen.includes(q.id))).toBe(false);
  });
  it('returns a short module instead of failing when a domain runs dry', () => {
    const small: Index = { rw: idx.rw.filter(q => q.dom !== 'SEC').concat(idx.rw.filter(q => q.dom === 'SEC' && !q.live).slice(0, 3)), math: [] };
    const { qs, short } = buildModule(small, 'rw', MIX.m1, opts());
    expect(short).toBe(true);
    expect(qs.filter(q => q.dom === 'SEC')).toHaveLength(3);
    expect(new Set(qs.map(q => q.id)).size).toBe(qs.length);
  });
  it('does not mutate seen', () => {
    const o = opts();
    buildModule(idx, 'rw', MIX.m1, o);
    expect(o.seen.size).toBe(0);
  });
});

describe('draw', () => {
  it('honours the difficulty mix and tops up when a tier is empty', () => {
    const p = makeIndex().math.filter(q => q.diff !== 'H');
    const out = draw(p, 10, { E: 0.2, M: 0.2, H: 0.6 }, new Set(), seeded(1));
    expect(out).toHaveLength(10);
  });
});

describe('custom drills and skills', () => {
  const idx = makeIndex();
  it('merges skill names that differ only by case', () => {
    const odd: Index = { rw: [...idx.rw, { ...idx.rw[1], id: 'x', ext: 'ex', skill: 'Cross-text Connections', live: 0, dom: 'CAS' }], math: [] };
    const s = skillsByDomain(odd, 'rw', ['CAS'], true);
    const keys = s.CAS.map(([k]) => k);
    expect(keys.filter(k => k === 'cross-text connections')).toHaveLength(1);
    expect(keys).toHaveLength(3);
  });
  it('filters by domain, difficulty and skill', () => {
    const qs = buildCustom(idx, 'math', ['H'], ['E'], 5, ['skill 0'], opts());
    expect(qs).toHaveLength(5);
    expect(qs.every(q => q.dom === 'H' && q.diff === 'E' && q.skill === 'skill 0')).toBe(true);
  });
  it('pool respects noActive', () => {
    expect(pool(idx, 'rw', true).some(q => q.live)).toBe(false);
    expect(pool(idx, 'rw', false).some(q => q.live)).toBe(true);
  });
});

describe('routeModule2', () => {
  it('routes at 60 percent', () => {
    expect(routeModule2(16, 27)).toBe('m2easy');
    expect(routeModule2(17, 27)).toBe('m2hard');
    expect(routeModule2(0, 0)).toBe('m2easy');
  });
});
