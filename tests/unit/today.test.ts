import { describe, it, expect } from 'vitest';
import type { Index, Meta, Diff } from '../../src/api/questions';
import type { Answer } from '../../src/store/state';
import { defaultState } from '../../src/store/state';
import { buildToday, todayCount } from '../../src/trainer/today';
import { setTag, tagSplit } from '../../src/trainer/tags';
import { seeded } from '../../src/bank/build';

const DAY = 864e5, NOW = 100 * DAY;
const SKILLS: [string, string, 'rw' | 'math'][] = [['CAS', 'Words in Context', 'rw'], ['INI', 'Inferences', 'rw'], ['H', 'Linear equations', 'math'],
  ['P', 'Nonlinear functions', 'math'], ['Q', 'Percentages', 'math'], ['S', 'Circles', 'math']];
function index(): Index {
  const idx: Index = { rw: [], math: [] };
  let i = 0;
  for (const [dom, skill, sec] of SKILLS) for (let k = 0; k < 12; k++, i++)
    idx[sec].push({ id: 'q' + i, ext: 'e' + i, dom, domName: dom, skill, diff: (['E', 'M', 'H'] as Diff[])[k % 3], live: 0, type: 'mcq' });
  return idx;
}
const answersFor = (m: Meta[], ok: boolean, n: number): Answer[] =>
  m.slice(0, n).map(q => ({ qid: q.id, ext: q.ext, sec: q.dom === 'CAS' || q.dom === 'INI' ? 'rw' : 'math', dom: q.dom, skill: q.skill, diff: q.diff,
    resp: 0, ok, ms: 60000, mode: 'custom', at: NOW - DAY, timed: true }));

describe('todayCount', () => {
  it('turns minutes into a question count', () => {
    expect([10, 20, 40].map(todayCount)).toEqual([7, 14, 29]);
    expect(todayCount(1)).toBe(3);
  });
});

describe('buildToday', () => {
  it('gives a new student a session spread across skills', () => {
    const r = buildToday(index(), defaultState(), 20, NOW, seeded(1));
    expect(r.metas).toHaveLength(14);
    expect(new Set(r.metas.map(q => q.skill)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(r.metas.map(q => q.id)).size).toBe(14);
  });
  it('puts due reviews first, capped at 40% of the session', () => {
    const idx = index(), st = defaultState();
    for (const q of idx.math.slice(0, 10)) st.review[q.ext] = { sec: 'math', stage: 0, due: NOW - 1, okDays: [], misses: 1, lastMiss: 0 };
    const r = buildToday(idx, st, 20, NOW, seeded(2));
    expect(r.parts.review).toBe(Math.floor(14 * 0.4));
    expect(r.metas.slice(0, r.parts.review).every(q => st.review[q.ext])).toBe(true);
  });
  it('ranks a weak skill above a strong one', () => {
    const idx = index(), st = defaultState();
    const byskill = (s: string) => [...idx.rw, ...idx.math].filter(q => q.skill === s);
    st.answers = [...answersFor(byskill('Circles'), false, 8), ...answersFor(byskill('Percentages'), true, 8),
      ...answersFor(byskill('Words in Context'), true, 8), ...answersFor(byskill('Inferences'), true, 8),
      ...answersFor(byskill('Linear equations'), true, 8), ...answersFor(byskill('Nonlinear functions'), true, 8)];
    const r = buildToday(idx, st, 10, NOW, seeded(3));
    const weak = r.metas.slice(r.parts.review, r.parts.review + r.parts.weak);
    expect(weak.filter(q => q.skill === 'Circles').length).toBeGreaterThanOrEqual(2);
  });
  it('skips skills with no usable questions and still fills the session', () => {
    const idx = index();
    for (const q of idx.rw) q.live = 1;           // every rw question is active
    const r = buildToday(idx, defaultState(), 20, NOW, seeded(4));
    expect(r.metas).toHaveLength(14);
    expect(r.metas.every(q => !q.live)).toBe(true);
  });
  it('tops up when the pool is small and never repeats', () => {
    const idx: Index = { rw: [], math: index().math.slice(0, 9) };
    const r = buildToday(idx, defaultState(), 40, NOW, seeded(5));
    expect(r.metas).toHaveLength(9);
    expect(new Set(r.metas.map(q => q.id)).size).toBe(9);
  });
});

describe('tags', () => {
  const a = (ext: string, at: number): Answer => ({ qid: ext, ext, sec: 'math', dom: 'H', skill: 's', diff: 'M', resp: 0, ok: false, ms: 1, mode: 'custom', at });
  it('tags only the matching answer and keeps the latest tag', () => {
    let log = [a('x', 1), a('x', 2), a('y', 1)];
    log = setTag(log, 1, 'x', 'careless');
    log = setTag(log, 1, 'x', 'concept');
    expect(log.map(l => l.tag)).toEqual(['concept', undefined, undefined]);
    expect(tagSplit(log)).toEqual({ concept: 1, careless: 0, misread: 0, time: 0, guessed: 0 });
    expect(setTag(log, 1, 'x', null)[0].tag).toBeUndefined();
  });
});

describe('splitText', () => {
  it('describes each non-empty part of a session', async () => {
    const { splitText } = await import('../../src/trainer/today');
    expect(splitText({ review: 5, weak: 7, keep: 2 }, 14)).toBe('5 mistakes due for review, 7 from skills to work on, 2 to keep strong skills sharp');
    expect(splitText({ review: 1, weak: 12, keep: 0 }, 14)).toBe('1 mistake due for review, 12 from skills to work on, 1 more mixed in');
    expect(splitText({ review: 0, weak: 0, keep: 0 }, 9)).toBe('9 more mixed in');
  });
});
