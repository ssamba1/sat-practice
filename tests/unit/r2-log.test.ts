import { describe, it, expect } from 'vitest';
import type { Question } from '../../src/api/questions';
import { startSession, drillPlan, tick, answer, finish } from '../../src/session/machine';
import { migrate, defaultState } from '../../src/store/state';

const q = (i: number): Question => ({ id: 'id' + i, ext: 'ext' + i, dom: 'H', domName: 'Algebra', skill: 's', diff: 'M', live: 0, type: 'mcq',
  v: 3, sti: '', stem: 's', opts: ['a', 'b', 'c', 'd'], ans: ['B'], rat: '' });
const MIN = 60000;

describe('soft clock', () => {
  it('counts down to zero but never ends the session', () => {
    let s = startSession('today', true, drillPlan([q(1), q(2)], 1, 'Today', true), 0);
    s = tick(s, 0); s = tick(s, 5 * MIN);
    expect(s.view).toBe('q');
    expect(s.remainingMs).toBe(0);
    expect(s.expired).toBe(false);
  });
});

describe('finish records timing and mode', () => {
  it('marks timed answers and totals the time', () => {
    let s = startSession('custom', false, drillPlan([q(1)], 5), 0);
    s = tick(s, 0); s = tick(s, 3000); s = answer(s, 1);
    const r = finish(s, 4000);
    expect(r.answers[0].timed).toBe(true);
    expect(r.record).toMatchObject({ mode: 'custom', ms: 4000 });
  });
  it('marks untimed answers', () => {
    const s = startSession('mistakes', false, drillPlan([q(1)], null), 0);
    expect(finish(s, 0).answers[0].timed).toBe(false);
  });
});

describe('state migration for release 2', () => {
  it('defaults todayTutor to true and keeps old answers without timed', () => {
    const old = { ...defaultState(), settings: { noActive: true, tutor: false, theme: 'system' } } as any;
    old.answers = [{ qid: 'q', ext: 'e', sec: 'rw', dom: 'CAS', skill: 'x', diff: 'E', resp: 0, ok: true, ms: 5, mode: 'custom', at: 1 }];
    const m = migrate(old);
    expect(m.settings.todayTutor).toBe(true);
    expect(m.answers).toHaveLength(1);
  });
  it('keeps a valid test date and drops a malformed one', () => {
    const good = migrate({ ...defaultState(), settings: { ...defaultState().settings, goal: { testDate: '2027-03-13' } } });
    expect(good.settings.goal).toEqual({ testDate: '2027-03-13' });
    const bad = migrate({ ...defaultState(), settings: { ...defaultState().settings, goal: { testDate: 'soon' } } });
    expect(bad.settings.goal).toBeUndefined();
  });
});

describe('soft clock display', () => {
  it('says time is up without warning colours once a soft clock runs out', async () => {
    const { clockView } = await import('../../src/session/machine');
    expect(clockView(0, true)).toEqual({ text: "Time's up, keep going", low: false });
    expect(clockView(60000, true)).toEqual({ text: '01:00', low: false });
    expect(clockView(60000, false)).toEqual({ text: '01:00', low: true });
    expect(clockView(6 * 60000, false)).toEqual({ text: '06:00', low: false });
  });
});
