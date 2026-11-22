import { describe, it, expect } from 'vitest';
import { applyAnswers, dueItems, INTERVALS_DAYS, dayKey } from '../../src/review/schedule';
import type { Answer } from '../../src/store/state';

const DAY = 864e5;
const T0 = new Date(2026, 10, 22, 9).getTime();
const a = (ext: string, ok: boolean, at: number): Answer =>
  ({ qid: 'q' + ext, ext, sec: 'math', dom: 'H', skill: 's', diff: 'M', resp: 0, ok, ms: 1, mode: 'custom', at });

describe('spaced review', () => {
  it('adds a miss at stage 0, due in one day', () => {
    const { review, added } = applyAnswers({}, [a('x', false, T0)], T0);
    expect(added).toBe(1);
    expect(review.x).toMatchObject({ stage: 0, due: T0 + DAY, okDays: [], misses: 1, sec: 'math' });
  });
  it('keeps an item answered correctly twice on the same day', () => {
    let r = applyAnswers({}, [a('x', false, T0)], T0).review;
    r = applyAnswers(r, [a('x', true, T0 + 3600e3)], T0 + 3600e3).review;
    r = applyAnswers(r, [a('x', true, T0 + 7200e3)], T0 + 7200e3).review;
    expect(r.x.okDays).toEqual([dayKey(T0)]);
    expect(r.x.stage).toBe(1);
    expect(r.x.due).toBe(T0 + 3600e3 + INTERVALS_DAYS[1] * DAY);
  });
  it('clears an item after correct answers on two different days', () => {
    let r = applyAnswers({}, [a('x', false, T0)], T0).review;
    r = applyAnswers(r, [a('x', true, T0 + DAY)], T0 + DAY).review;
    const res = applyAnswers(r, [a('x', true, T0 + 4 * DAY)], T0 + 4 * DAY);
    expect(res.review.x).toBeUndefined();
    expect(res.cleared).toBe(1);
  });
  it('resets to stage 0 when missed again', () => {
    let r = applyAnswers({}, [a('x', false, T0)], T0).review;
    r = applyAnswers(r, [a('x', true, T0 + DAY)], T0 + DAY).review;
    r = applyAnswers(r, [a('x', false, T0 + 2 * DAY)], T0 + 2 * DAY).review;
    expect(r.x).toMatchObject({ stage: 0, okDays: [], misses: 2 });
  });
  it('ignores correct answers to questions not under review', () => {
    expect(applyAnswers({}, [a('y', true, T0)], T0).review).toEqual({});
  });
  it('lists due items, most overdue first', () => {
    let r = applyAnswers({}, [a('x', false, T0), a('y', false, T0 - DAY)], T0).review;
    r.y.due = T0 - DAY;
    expect(dueItems(r, T0 + 2 * DAY)).toEqual(['y', 'x']);
    expect(dueItems(r, T0)).toEqual(['y']);
  });
});
