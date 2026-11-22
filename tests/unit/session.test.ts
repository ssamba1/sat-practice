import { describe, it, expect } from 'vitest';
import type { Question } from '../../src/api/questions';
import {
  fullTestPlan, modulePlan, drillPlan, startSession, setStageQs, needsQs, answer, goTo, toReview,
  submitModule, tick, finish, check, toggleMark, strike, currentStage, currentQs,
} from '../../src/session/machine';
import { snapshot, restore } from '../../src/session/resume';

const q = (i: number, dom = 'H', type: 'mcq' | 'spr' = 'mcq'): Question => ({
  id: 'id' + i, ext: 'ext' + i, dom, domName: dom, skill: 's', diff: 'M', live: 0, type,
  v: 2, sti: '', stem: 'stem ' + i, opts: ['a', 'b', 'c', 'd'], ans: type === 'spr' ? ['1/2'] : ['B'], rat: '',
});
const many = (n: number, dom = 'H') => Array.from({ length: n }, (_, i) => q(i + (dom === 'CAS' ? 1000 : 0), dom));
const MIN = 60000;

describe('plans', () => {
  it('full test has two rw modules, a break and two math modules at real timing', () => {
    const p = fullTestPlan();
    expect(p.map(s => s.kind === 'module' ? `${s.sec}:${s.mins}` : `break:${s.mins}`))
      .toEqual(['rw:32', 'rw:32', 'break:10', 'math:35', 'math:35']);
  });
  it('a full test reaches 98 questions once every module is filled', () => {
    let s = startSession('full', false, fullTestPlan(), 0);
    const sizes: number[] = [];
    for (let guard = 0; s.view !== 'results' && guard < 20; guard++) {
      if (needsQs(s)) { const st = currentStage(s); const n = st.kind === 'module' && st.sec === 'rw' ? 27 : 22; s = setStageQs(s, many(n, n === 27 ? 'CAS' : 'H')); sizes.push(n); }
      s = s.view === 'break' ? tick(s, 0) : submitModule(s, 0);
      if (s.view === 'break') s = submitModule(s, 0);
    }
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(98);
    expect(s.view).toBe('results');
  });
});

describe('timing', () => {
  it('charges time only to the question on screen', () => {
    let s = startSession('custom', false, drillPlan(many(3), 10), 0);
    s = tick(s, 1000);            // first tick starts the clock, charges nothing
    s = tick(s, 4000);
    s = goTo(s, 1, 5000);
    s = tick(s, 7000);
    expect(s.time[0]).toEqual([4000, 2000, 0]);
    expect(s.remainingMs).toBe(10 * MIN - 6000);
  });
  it('moves to the review page once when time runs out', () => {
    let s = startSession('module', false, modulePlan('math'), 0);
    s = setStageQs(s, many(22));
    s = tick(s, 0);
    s = tick(s, 35 * MIN + 1);
    expect(s.view).toBe('review');
    s = goTo(s, 3, 35 * MIN + 2);   // student goes back to a question
    s = tick(s, 35 * MIN + 500);
    expect(s.view).toBe('q');       // expiry does not fire again
  });
  it('an untimed drill never expires', () => {
    let s = startSession('custom', false, drillPlan(many(2), null), 0);
    s = tick(s, 0); s = tick(s, 999 * MIN);
    expect(s.view).toBe('q');
    expect(s.remainingMs).toBeNull();
  });
});

describe('answering', () => {
  it('locks a checked answer in tutor mode', () => {
    let s = startSession('custom', true, drillPlan(many(2), null), 0);
    s = answer(s, 2); s = check(s);
    s = answer(s, 1);
    expect(s.resp[0][0]).toBe(2);
    expect(s.checked[0][0]).toBe(true);
  });
  it('test-day modes cannot check', () => {
    let s = startSession('module', true, modulePlan('math'), 0);
    s = setStageQs(s, many(22));
    expect(s.tutor).toBe(false);
    s = answer(s, 1); s = check(s);
    expect(s.checked[0][0]).toBe(false);
  });
  it('marks and strikes', () => {
    let s = startSession('custom', false, drillPlan(many(2), null), 0);
    s = toggleMark(s); s = strike(s, 2); s = strike(s, 3); s = strike(s, 2);
    expect(s.marked[0][0]).toBe(true);
    expect(s.struck[0][0]).toEqual([3]);
  });
});

describe('finish', () => {
  it('returns one answer per question with time and mode', () => {
    let s = startSession('custom', false, drillPlan([q(1), q(2, 'CAS'), q(3, 'H', 'spr')], null), 0);
    s = answer(s, 1); s = goTo(s, 1, 0); s = answer(s, 0); s = goTo(s, 2, 0); s = answer(s, '0.5');
    s = toReview(s, 0);
    const { answers, record } = finish(s, 50);
    expect(answers.map(a => [a.ext, a.ok, a.sec, a.mode])).toEqual([
      ['ext1', true, 'math', 'custom'], ['ext2', false, 'rw', 'custom'], ['ext3', true, 'math', 'custom']]);
    expect(record).toMatchObject({ correct: 2, total: 3, at: 50, doms: { Algebra: [2, 2], 'Craft and Structure': [0, 1] } });
  });
});

describe('resume', () => {
  it('pauses the clock while the tab is closed', async () => {
    let s = startSession('module', false, modulePlan('math'), 0);
    const qs = many(22);
    s = setStageQs(s, qs);
    s = tick(s, 0); s = tick(s, 5 * MIN); s = answer(s, 3);
    const snap = snapshot(s, 5 * MIN);
    const r = await restore(snap, async exts => exts.map(e => qs.find(x => x.ext === e)!), 5 * MIN + 3 * 3600e3);
    expect(r).not.toBeNull();
    expect(r!.gapMs).toBe(3 * 3600e3);
    let back = r!.session;
    expect(back.remainingMs).toBe(30 * MIN);
    back = tick(back, 5 * MIN + 3 * 3600e3);     // first tick after resume charges nothing
    expect(back.remainingMs).toBe(30 * MIN);
    expect(back.resp[0][0]).toBe(3);
    expect(currentQs(back)?.length).toBe(22);
  });
  it('rejects week-old or malformed snapshots', async () => {
    const s = startSession('custom', false, drillPlan(many(1), null), 0);
    const snap = snapshot(s, 0);
    expect(await restore(snap, async () => [], 8 * 864e5)).toBeNull();
    expect(await restore('{nope', async () => [], 0)).toBeNull();
    expect(await restore(JSON.stringify({ v: 9 }), async () => [], 0)).toBeNull();
  });
});
