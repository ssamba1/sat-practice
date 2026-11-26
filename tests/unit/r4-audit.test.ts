import { describe, it, expect } from 'vitest';
import type { Answer } from '../../src/store/state';
import { registration } from '../../src/trainer/goal';
import { SAT_DATES } from '../../src/data/satdates';
import { applyAnswers } from '../../src/review/schedule';
import { summarise } from '../../src/stats/summary';
import { secs } from '../../src/ui/Results';
import { trimOld, defaultState } from '../../src/store/state';

const dec5 = SAT_DATES.find(d => d.date === '2026-12-05')!;

describe('registration status for an official date', () => {
  // deadlines end at 11:59 p.m. ET; in November ET is UTC-5
  const utc = (iso: string) => Date.parse(iso + 'Z');
  it('moves from regular to late to closed (College Board, read 2026-11-25)', () => {
    expect(registration(dec5, utc('2026-11-21T04:58:00'))).toEqual({ kind: 'regular', until: '2026-11-20' });
    expect(registration(dec5, utc('2026-11-21T05:01:00'))).toEqual({ kind: 'late', until: '2026-11-24' });
    expect(registration(dec5, utc('2026-11-25T04:58:00'))).toEqual({ kind: 'late', until: '2026-11-24' });
    expect(registration(dec5, utc('2026-11-25T05:01:00'))).toEqual({ kind: 'closed' });
  });
  it('uses daylight time for a spring deadline (ET is UTC-4 in May)', () => {
    const jun5 = SAT_DATES.find(d => d.date === '2027-06-05')!;
    expect(registration(jun5, utc('2027-05-22T03:58:00')).kind).toBe('regular');
    expect(registration(jun5, utc('2027-05-22T04:01:00')).kind).toBe('late');
  });
  it('has no deadlines for a date College Board has not confirmed', () => {
    expect(registration(SAT_DATES.find(d => d.expected)!, utc('2026-11-25T12:00:00'))).toEqual({ kind: 'expected' });
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

describe('making room when storage is full', () => {
  const DAY = 864e5, NOW = 1000 * DAY;
  it('drops only answers older than a year and keeps everything else', () => {
    const st = defaultState();
    st.answers = [a(0, true, 'custom', NOW - 400 * DAY), a(0, true, 'custom', NOW - 300 * DAY), a(0, false, 'custom', NOW)];
    st.sessions = [{ id: '1', at: NOW - 400 * DAY, label: 'old', correct: 1, total: 1, doms: {}, mode: 'custom', ms: 1 }];
    const r = trimOld(st, NOW);
    expect(r.dropped).toBe(1);
    expect(r.state.answers.map(x => x.at)).toEqual([NOW - 300 * DAY, NOW]);
    expect(r.state.sessions).toHaveLength(1);
  });
});
