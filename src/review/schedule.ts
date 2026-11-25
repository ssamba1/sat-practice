import type { Section } from '../api/questions';
import type { Answer } from '../store/state';

export interface ReviewItem { sec: Section; stage: 0 | 1 | 2 | 3; due: number; okDays: string[]; misses: number; lastMiss: number }

export const INTERVALS_DAYS = [1, 3, 7, 21];
const DAY = 864e5;

/** Local calendar date, so "two different days" means what the student thinks it means. */
export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A miss enters or resets an item. A correct answer advances it; correct answers on
 *  two different days clear it. */
export function applyAnswers(review: Record<string, ReviewItem>, answers: Answer[], now: number) {
  const out = { ...review };
  let added = 0, cleared = 0;
  for (const a of answers) {
    if (!a.ext) continue;
    // a blank in practice was never tried; on a timed test it counts, as on test day
    if ((a.resp == null || a.resp === '') && a.mode !== 'full' && a.mode !== 'module') continue;
    const prev = out[a.ext];
    if (!a.ok) {
      if (!prev) added++;
      out[a.ext] = { sec: a.sec, stage: 0, due: now + INTERVALS_DAYS[0] * DAY, okDays: [], misses: (prev?.misses ?? 0) + 1, lastMiss: a.at };
    } else if (prev) {
      const day = dayKey(a.at);
      if (prev.okDays.includes(day)) continue;
      const okDays = [...prev.okDays, day];
      if (okDays.length >= 2) { delete out[a.ext]; cleared++; continue; }
      const stage = Math.min(3, prev.stage + 1) as ReviewItem['stage'];
      out[a.ext] = { ...prev, okDays, stage, due: now + INTERVALS_DAYS[stage] * DAY };
    }
  }
  return { review: out, added, cleared };
}

export const dueItems = (review: Record<string, ReviewItem>, now: number): string[] =>
  Object.entries(review).filter(([, r]) => r.due <= now).sort((a, b) => a[1].due - b[1].due).map(([k]) => k);
