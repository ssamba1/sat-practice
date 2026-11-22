import type { Answer } from '../store/state';
import { budgetMs, type SkillStat } from './mastery';

/** Skills you get right but slowly: mastery 75%+, on at least 5 timed answers, averaging over 1.3x the budget. */
export const rightButSlow = (stats: SkillStat[]) =>
  stats.filter(s => s.mastery != null && s.mastery >= 0.75 && s.timedN >= 5 && s.avgMs != null && s.avgMs > 1.3 * s.budgetMs);

/** Timed misses in the last `days` days that took more than twice the per-question budget. */
export const slowMisses = (answers: Answer[], now: number, days = 30) =>
  answers.filter(a => !a.ok && a.timed && now - a.at <= days * 864e5 && a.ms > 2 * budgetMs(a.sec));
