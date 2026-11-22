import { describe, it, expect } from 'vitest';
import { summarise, domainProgress } from '../../src/stats/summary';
import type { Answer, SessionRecord } from '../../src/store/state';

const a = (ext: string, dom: string, skill: string, diff: 'E' | 'M' | 'H', ok: boolean, ms: number): Answer =>
  ({ qid: ext, ext, sec: 'math', dom, skill, diff, resp: 0, ok, ms, mode: 'custom', at: 0 });

const ANS = [
  a('1', 'H', 'Linear', 'E', true, 30000),
  a('2', 'H', 'Linear', 'M', false, 200000),
  a('3', 'P', 'Quadratic', 'H', true, 60000),
  a('4', 'P', 'quadratic', 'H', false, 50000),
];

describe('summarise', () => {
  it('counts, averages and flags slow questions', () => {
    const s = summarise(ANS, 90000);
    expect(s.correct).toBe(2);
    expect(s.total).toBe(4);
    expect(s.avgMs).toBe(85000);
    expect(s.okAvgMs).toBe(45000);
    expect(s.wrongAvgMs).toBe(125000);
    expect(s.slow).toEqual(['2']);
    expect(s.byDomain.H).toEqual({ ok: 1, n: 2, ms: 230000 });
    expect(s.bySkill.quadratic).toMatchObject({ ok: 1, n: 2, label: 'Quadratic' });
    expect(s.byDiff.H).toEqual({ ok: 1, n: 2, ms: 110000 });
  });
  it('flags nothing without a time budget', () => {
    expect(summarise(ANS, null).slow).toEqual([]);
  });
  it('handles an empty session', () => {
    expect(summarise([], 1000)).toMatchObject({ correct: 0, total: 0, avgMs: 0, okAvgMs: 0, wrongAvgMs: 0 });
  });
});

describe('domainProgress', () => {
  const rec = (doms: Record<string, [number, number]>, legacy = false): SessionRecord =>
    ({ id: 'x', at: 0, label: 'l', correct: 0, total: 0, doms, ...(legacy ? { legacy: true as const } : {}) });
  it('totals every session and the last five, legacy included', () => {
    const sessions = [rec({ H: [1, 2] }), rec({ H: [2, 2] }), rec({ H: [0, 2] }), rec({ H: [1, 1] }), rec({ H: [1, 1] }), rec({ H: [0, 4] }, true)];
    const p = domainProgress(sessions, 5);
    expect(p.H.all).toEqual([5, 12]);
    expect(p.H.recent).toEqual([5, 8]);
  });
});
