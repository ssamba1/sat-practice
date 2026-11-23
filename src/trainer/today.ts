import type { Diff, Index, Meta, Section } from '../api/questions';
import type { AppState } from '../store/state';
import { pool, shuffle, skillKey, type Rng } from '../bank/build';
import { dueItems } from '../review/schedule';
import { skillStats, band } from './mastery';

export const SECS_PER_Q = 83;   // mean of the per-question budgets: 71 s Reading and Writing, 95 s Math
export const todayCount = (mins: number) => Math.max(3, Math.round(mins * 60 / SECS_PER_Q));

const DIFFS: Record<ReturnType<typeof band>, Diff[]> = {
  unknown: ['E', 'M'], weak: ['E', 'M'], shaky: ['M'], solid: ['M', 'H'], strong: ['M', 'H'],
};

/** Today: due reviews first (at most 40%), then the weakest skills, then a little upkeep
 *  on strong ones (about 15%). Any shortfall tops up from the rest of the usable pool. */
export function buildToday(index: Index, st: AppState, mins: number, now: number, rng: Rng = Math.random) {
  const n = todayCount(mins), noActive = st.settings.noActive, seen = new Set(st.seen);
  const usable = (['rw', 'math'] as Section[]).flatMap(s => pool(index, s, noActive));
  const used = new Set<string>(), out: Meta[] = [];
  const take = (q: Meta | undefined) => { if (q && !used.has(q.id) && out.length < n) { used.add(q.id); out.push(q); return true; } return false; };
  const unseenFirst = (qs: Meta[]) => { const s = shuffle(qs.slice(), rng); return s.filter(q => !seen.has(q.id)).concat(s.filter(q => seen.has(q.id))); };

  // 1. reviews: from the whole index, since a question you already missed spoils nothing
  const all = new Map([...index.rw, ...index.math].map(q => [q.ext, q]));
  const reviewCap = Math.floor(n * 0.4);
  for (const ext of dueItems(st.review, now)) { if (out.length >= reviewCap) break; take(all.get(ext)); }
  const review = out.length;

  // 2. weakest skills; untried ones rank as 50% so a new student explores
  const stats = skillStats(st.answers, index, noActive, now).filter(s => s.available > 0);
  const ranked = shuffle(stats.slice(), rng).sort((a, b) => (a.mastery ?? 0.5) - (b.mastery ?? 0.5));
  const keepTarget = Math.round(n * 0.15), weakEnd = n - keepTarget;
  const fromSkill = (key: string, k: number, diffs: Diff[]) => {
    const mine = usable.filter(q => skillKey(q) === key && !used.has(q.id));
    const pick = unseenFirst(mine.filter(q => diffs.includes(q.diff))).concat(unseenFirst(mine.filter(q => !diffs.includes(q.diff))));
    let got = 0;
    for (const q of pick) { if (got >= k || out.length >= weakEnd + (k === 1 ? keepTarget : 0)) break; if (take(q)) got++; }
  };
  for (const s of ranked) {
    if (out.length >= weakEnd) break;
    const b = band(s.mastery, s.easyOnly);
    fromSkill(s.key, b === 'weak' ? 3 : 2, DIFFS[b]);
  }
  const weak = out.length - review;

  // 3. upkeep on the strongest known skills, one question each
  for (const s of [...ranked].reverse()) {
    if (out.length >= n) break;
    if (s.mastery != null && s.mastery >= 0.75) fromSkill(s.key, 1, DIFFS[band(s.mastery, s.easyOnly)]);
  }
  const keep = out.length - review - weak;

  // 4. anything left: any usable question
  for (const q of unseenFirst(usable)) { if (out.length >= n) break; take(q); }
  return { metas: out, parts: { review, weak, keep } };
}

/** The session's make-up in words, skipping empty parts. */
export function splitText(p: { review: number; weak: number; keep: number }, total: number) {
  const rest = total - p.review - p.weak - p.keep;
  return [
    p.review && `${p.review} mistake${p.review > 1 ? 's' : ''} due for review`,
    p.weak && `${p.weak} from skills to work on`,
    p.keep && `${p.keep} to keep strong skills sharp`,
    rest > 0 && `${rest} more mixed in`,
  ].filter(Boolean).join(', ');
}
