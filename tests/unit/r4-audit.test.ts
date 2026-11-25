import { describe, it, expect } from 'vitest';
import type { Answer } from '../../src/store/state';
import { registration } from '../../src/trainer/goal';
import { SAT_DATES } from '../../src/data/satdates';
import { applyAnswers } from '../../src/review/schedule';
import { summarise } from '../../src/stats/summary';
import { secs } from '../../src/ui/Results';

const at = (iso: string) => new Date(iso + 'T12:00:00').getTime();
const dec5 = SAT_DATES.find(d => d.date === '2026-12-05')!;

describe('registration status for an official date', () => {
  it('moves from regular to late to closed (College Board, read 2026-11-25)', () => {
    expect(registration(dec5, at('2026-11-20'))).toEqual({ kind: 'regular', until: '2026-11-20' });
    expect(registration(dec5, at('2026-11-21'))).toEqual({ kind: 'late', until: '2026-11-24' });
    expect(registration(dec5, at('2026-11-25'))).toEqual({ kind: 'closed' });
  });
  it('has no deadlines for a date College Board has not confirmed', () => {
    expect(registration(SAT_DATES.find(d => d.expected)!, at('2026-11-25'))).toEqual({ kind: 'expected' });
  });
});

const a = (resp: Answer['resp'], ok: boolean, mode: Answer['mode'], t = 1): Answer =>
  ({ qid: 'q', ext: 'x', sec: 'math', dom: 'H', skill: 's', diff: 'M', resp, ok, ms: 1, mode, at: t });

describe('unanswered questions and the mistakes list', () => {
  it('a blank in practice neither adds an item nor wipes its progress', () => {
    expect(applyAnswers({}, [a(null, false, 'today')], 10).added).toBe(0);
    const prev = { x: { sec: 'math' as const, stage: 1 as const, due: 5, okDays: ['2026-11-23'], misses: 1, lastMiss: 0 } };
    expect(applyAnswers(prev, [a('', false, 'custom')], 10).review).toEqual(prev);
  });
  it('a blank on a timed test still counts as a miss, as on test day', () => {
    expect(applyAnswers({}, [a(null, false, 'full')], 10).added).toBe(1);
    expect(applyAnswers({}, [a(null, false, 'module')], 10).added).toBe(1);
  });
});

describe('pacing on a full test', () => {
  it('judges each question against its own section budget', () => {
    const rw = { ...a(0, true, 'full'), ext: 'rw', sec: 'rw' as const, ms: 150000 };   // over 2 x 71 s
    const m = { ...a(0, true, 'full'), ext: 'm', ms: 170000 };                       // under 2 x 95 s
    expect(summarise([rw, m], q => (q.sec === 'rw' ? 32 * 60000 / 27 : 35 * 60000 / 22)).slow).toEqual(['rw']);
  });
});

describe('time format', () => {
  it('never shows 60 seconds', () => {
    expect(secs(119600)).toBe('2m 0s');
    expect(secs(59600)).toBe('1m 0s');
    expect(secs(61000)).toBe('1m 1s');
    expect(secs(4400)).toBe('4s');
  });
});
