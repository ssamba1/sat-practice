import type { Diff, Index, Section } from '../api/questions';
import type { Answer } from '../store/state';
import { SPEC } from '../bank/spec';
import { pool, skillKey } from '../bank/build';

export const HALF_LIFE_DAYS = 30;
export const DIFF_WEIGHT: Record<Diff, number> = { E: 1, M: 1.5, H: 2 };
export const MIN_ANSWERS = 5;
/** Shown in the UI: the whole model in one sentence. */
export const FORMULA = 'Mastery is your accuracy on a skill, with harder questions counting more and an answer counting half as much after 30 days.';

export interface SkillStat {
  key: string; label: string; sec: Section; dom: string; n: number; mastery: number | null;
  avgMs: number | null; timedN: number; budgetMs: number; tags: Record<string, number>; available: number;
}

export const budgetMs = (sec: Section) => SPEC[sec].mins * 60000 / SPEC[sec].qs;

export function skillStats(answers: Answer[], index: Index, noActive: boolean, now: number): SkillStat[] {
  const by = new Map<string, SkillStat & { w: number; wOk: number; timedMs: number }>();
  for (const sec of ['rw', 'math'] as Section[]) {
    const usable = new Set(pool(index, sec, noActive).map(q => q.id));
    for (const q of index[sec]) {
      const key = skillKey(q);
      let s = by.get(key);
      if (!s) by.set(key, s = { key, label: q.skill.trim(), sec, dom: q.dom, n: 0, mastery: null, avgMs: null, timedN: 0,
        budgetMs: budgetMs(sec), tags: {}, available: 0, w: 0, wOk: 0, timedMs: 0 });
      if (usable.has(q.id)) s.available++;
    }
  }
  for (const a of answers) {
    const s = by.get(a.skill.trim().toLowerCase());
    if (!s) continue;   // a skill College Board has since dropped
    if (a.resp == null || a.resp === '') continue;   // never answered: says nothing about the skill
    const w = 0.5 ** (Math.max(0, now - a.at) / 864e5 / HALF_LIFE_DAYS) * (DIFF_WEIGHT[a.diff] ?? 1);
    s.n++; s.w += w; if (a.ok) s.wOk += w;
    if (a.timed) { s.timedN++; s.timedMs += a.ms; }
    if (a.tag) s.tags[a.tag] = (s.tags[a.tag] ?? 0) + 1;
  }
  return [...by.values()].map(({ w, wOk, timedMs, ...s }) => ({
    ...s,
    mastery: s.n >= MIN_ANSWERS && w > 0 ? wOk / w : null,
    avgMs: s.timedN ? timedMs / s.timedN : null,
  }));
}

export function band(m: number | null): 'unknown' | 'weak' | 'shaky' | 'solid' | 'strong' {
  if (m == null) return 'unknown';
  return m < 0.5 ? 'weak' : m < 0.75 ? 'shaky' : m < 0.9 ? 'solid' : 'strong';
}
