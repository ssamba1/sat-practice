import type { Answer, SessionRecord } from '../store/state';

export interface Tally { ok: number; n: number; ms: number }
const add = (t: Tally | undefined, a: Answer): Tally => ({ ok: (t?.ok ?? 0) + +a.ok, n: (t?.n ?? 0) + 1, ms: (t?.ms ?? 0) + a.ms });
const mean = (xs: number[]) => xs.length ? xs.reduce((p, c) => p + c, 0) / xs.length : 0;

/** Score, breakdowns and pacing for one session. `slow` lists questions over twice the budget. */
export function summarise(answers: Answer[], budgetMs: number | null | ((a: Answer) => number)) {
  const budget = (a: Answer) => typeof budgetMs === 'function' ? budgetMs(a) : budgetMs!;
  const byDomain: Record<string, Tally> = {}, byDiff: Record<string, Tally> = {};
  const bySkill: Record<string, Tally & { label: string }> = {};
  for (const a of answers) {
    byDomain[a.dom] = add(byDomain[a.dom], a);
    byDiff[a.diff] = add(byDiff[a.diff], a);
    const k = a.skill.trim().toLowerCase();
    bySkill[k] = { ...add(bySkill[k], a), label: bySkill[k]?.label ?? a.skill.trim() };
  }
  return {
    correct: answers.filter(a => a.ok).length, total: answers.length,
    byDomain, bySkill, byDiff,
    avgMs: mean(answers.map(a => a.ms)),
    okAvgMs: mean(answers.filter(a => a.ok).map(a => a.ms)),
    wrongAvgMs: mean(answers.filter(a => !a.ok).map(a => a.ms)),
    slow: budgetMs == null ? [] : answers.filter(a => a.ms > 2 * budget(a)).map(a => a.ext),
  };
}

/** Accuracy per domain across every session and across the most recent `last` (newest first). */
export function domainProgress(sessions: SessionRecord[], last = 5) {
  const out: Record<string, { all: [number, number]; recent: [number, number] }> = {};
  sessions.forEach((s, i) => {
    for (const [dom, [ok, n]] of Object.entries(s.doms || {})) {
      const r = out[dom] ||= { all: [0, 0], recent: [0, 0] };
      r.all[0] += ok; r.all[1] += n;
      if (i < last) { r.recent[0] += ok; r.recent[1] += n; }
    }
  });
  return out;
}
