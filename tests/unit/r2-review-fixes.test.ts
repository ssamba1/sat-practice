import { describe, it, expect } from 'vitest';
import type { Question, Index } from '../../src/api/questions';
import type { Answer } from '../../src/store/state';
import { migrate, defaultState } from '../../src/store/state';
import { startSession, drillPlan, tick, answer, check, finish } from '../../src/session/machine';
import { skillStats } from '../../src/trainer/mastery';

const q = (i: number): Question => ({ id: 'id' + i, ext: 'ext' + i, dom: 'H', domName: 'Algebra', skill: 'Linear', diff: 'M', live: 0, type: 'mcq',
  v: 3, sti: '', stem: 's', opts: ['a', 'b', 'c', 'd'], ans: ['B'], rat: '' });
const IDX: Index = { rw: [], math: [{ id: 'id1', ext: 'ext1', dom: 'H', domName: 'Algebra', skill: 'Linear', diff: 'M', live: 0, type: 'mcq' }] };
const a = (ok: boolean, resp: Answer['resp']): Answer => ({ qid: 'q', ext: 'e', sec: 'math', dom: 'H', skill: 'Linear', diff: 'M', resp, ok, ms: 1000, mode: 'today', at: 0, timed: true });

describe('R2 Important 1: reading the explanation is not answer time', () => {
  it('stops charging a question once it is checked', () => {
    let s = startSession('today', true, drillPlan([q(1), q(2)], 10, 'Today', true), 0);
    s = tick(s, 0); s = tick(s, 60000); s = answer(s, 0); s = check(s);
    s = tick(s, 150000);
    expect(finish(s, 150000).answers[0].ms).toBe(60000);
  });
});

describe('R2 Important 2: blanks do not count toward mastery', () => {
  it('ignores unanswered questions', () => {
    const log = [...Array(5).fill(0).map(() => a(true, 1)), ...Array(19).fill(0).map(() => a(false, null)), a(false, '')];
    const s = skillStats(log, IDX, true, 0).find(x => x.key === 'linear')!;
    expect(s.n).toBe(5);
    expect(s.mastery).toBe(1);
  });
});

describe('R2 minor 2 regraded: a malformed answer cannot crash the trainer', () => {
  it('migrate drops answers without a usable skill, time or difficulty', () => {
    const good = a(true, 1);
    const st = migrate({ ...defaultState(), answers: [good, { ...good, skill: undefined }, { ...good, at: 'x' }, { ...good, diff: 'Z' }, { ...good, ms: undefined }] });
    expect(st.answers).toEqual([good]);
  });
});
