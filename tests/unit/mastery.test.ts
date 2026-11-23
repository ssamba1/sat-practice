import { describe, it, expect } from 'vitest';
import type { Index, Meta, Diff } from '../../src/api/questions';
import type { Answer } from '../../src/store/state';
import { skillStats, band, MIN_ANSWERS } from '../../src/trainer/mastery';
import { rightButSlow, slowMisses } from '../../src/trainer/pacing';

const DAY = 864e5, NOW = 100 * DAY;
const meta = (i: number, dom: string, skill: string, live: 0 | 1 = 0): Meta =>
  ({ id: 'q' + i, ext: 'e' + i, dom, domName: dom, skill, diff: 'M', live, type: 'mcq' });
const IDX: Index = {
  rw: [meta(1, 'CAS', 'Words in Context'), meta(2, 'CAS', 'Words in Context'), meta(3, 'INI', 'Inferences', 1)],
  math: [meta(4, 'H', 'Linear equations'), meta(5, 'P', 'Nonlinear functions')],
};
const ans = (skill: string, ok: boolean, diff: Diff = 'M', ageDays = 0, ms = 60000, timed = true, dom = 'H', sec: 'rw' | 'math' = 'math'): Answer =>
  ({ qid: 'x', ext: 'x', sec, dom, skill, diff, resp: 0, ok, ms, mode: 'custom', at: NOW - ageDays * DAY, timed });
const find = (stats: ReturnType<typeof skillStats>, key: string) => stats.find(s => s.key === key)!;

describe('skillStats', () => {
  it('lists every skill in the index, untried ones with no data', () => {
    const s = skillStats([], IDX, true, NOW);
    expect(s.map(x => x.key).sort()).toEqual(['inferences', 'linear equations', 'nonlinear functions', 'words in context']);
    const w = find(s, 'words in context');
    expect(w).toMatchObject({ n: 0, mastery: null, avgMs: null, timedN: 0, available: 2, sec: 'rw', dom: 'CAS' });
    expect(find(s, 'inferences').available).toBe(0);           // its only question is active
    expect(JSON.stringify(s)).not.toContain('NaN');
  });
  it('needs MIN_ANSWERS before giving a mastery', () => {
    const few = Array.from({ length: MIN_ANSWERS - 1 }, () => ans('Linear equations', true));
    expect(find(skillStats(few, IDX, true, NOW), 'linear equations').mastery).toBeNull();
    const enough = [...few, ans('Linear equations', false)];
    expect(find(skillStats(enough, IDX, true, NOW), 'linear equations').mastery).toBeCloseTo(4 / 5);
  });
  it('weights an answer half as much after 30 days', () => {
    // 4 recent wrong + 1 recent right, plus 2 right 30 days old: (1 + 2*0.5) / (5 + 2*0.5) = 2/6
    const a = [...Array(4).fill(0).map(() => ans('Linear equations', false)), ans('Linear equations', true),
      ans('Linear equations', true, 'M', 30), ans('Linear equations', true, 'M', 30)];
    expect(find(skillStats(a, IDX, true, NOW), 'linear equations').mastery).toBeCloseTo(2 / 6);
  });
  it('counts a hard right answer more than an easy one', () => {
    const base = [ans('Linear equations', false, 'M'), ans('Linear equations', false, 'M'), ans('Linear equations', false, 'M'), ans('Linear equations', false, 'M')];
    const hard = find(skillStats([...base, ans('Linear equations', true, 'H')], IDX, true, NOW), 'linear equations').mastery!;
    const easy = find(skillStats([...base, ans('Linear equations', true, 'E')], IDX, true, NOW), 'linear equations').mastery!;
    expect(hard).toBeGreaterThan(easy);
  });
  it('averages time over timed answers only and counts tags', () => {
    const a = [ans('Linear equations', true, 'M', 0, 40000), ans('Linear equations', true, 'M', 0, 999999, false), { ...ans('Linear equations', false), tag: 'careless' }];
    const s = find(skillStats(a, IDX, true, NOW), 'linear equations');
    expect(s.timedN).toBe(2);
    expect(s.avgMs).toBe(50000);
    expect(s.tags).toEqual({ careless: 1 });
    expect(s.budgetMs).toBeCloseTo(35 * 60000 / 22);
  });
  it('treats answers from before release 2 (no timed field) as untimed', () => {
    const old = { ...ans('Linear equations', true), timed: undefined };
    expect(find(skillStats([old], IDX, true, NOW), 'linear equations').timedN).toBe(0);
  });
});

describe('band', () => {
  it('maps mastery to words', () => {
    expect([null, 0.4, 0.6, 0.8, 0.95].map(m => band(m))).toEqual(['unknown', 'weak', 'shaky', 'solid', 'strong']);
  });
});

describe('pacing', () => {
  it('flags skills that are right but slow, on enough timed answers', () => {
    const slow = Array.from({ length: 5 }, () => ans('Linear equations', true, 'M', 0, 140000));
    const fast = Array.from({ length: 5 }, () => ans('Nonlinear functions', true, 'M', 0, 30000, true, 'P'));
    const flagged = rightButSlow(skillStats([...slow, ...fast], IDX, true, NOW)).map(s => s.key);
    expect(flagged).toEqual(['linear equations']);
  });
  it('lists recent timed misses that took over twice the budget', () => {
    const a = [ans('Linear equations', false, 'M', 1, 200000), ans('Linear equations', false, 'M', 1, 200000, false),
      ans('Linear equations', false, 'M', 40, 200000), ans('Linear equations', true, 'M', 1, 200000), ans('Linear equations', false, 'M', 1, 100000)];
    expect(slowMisses(a, NOW)).toHaveLength(1);
  });
});

describe('strong needs more than easy questions', () => {
  it('caps a skill at solid until a medium or hard question is right', () => {
    const easy = Array.from({ length: 6 }, () => ans('Linear equations', true, 'E'));
    const s = find(skillStats(easy, IDX, true, NOW), 'linear equations');
    expect(s.mastery).toBe(1);
    expect(band(s.mastery, s.easyOnly)).toBe('solid');
    const t = find(skillStats([...easy, ans('Linear equations', true, 'M')], IDX, true, NOW), 'linear equations');
    expect(band(t.mastery, t.easyOnly)).toBe('strong');
  });
  it('does not count a wrong hard answer as proof', () => {
    const a = [...Array.from({ length: 20 }, () => ans('Linear equations', true, 'E')), ans('Linear equations', false, 'H')];
    const s = find(skillStats(a, IDX, true, NOW), 'linear equations');
    expect(s.easyOnly).toBe(true);
  });
});
