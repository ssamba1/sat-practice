import type { Diff, Index, Meta, Section } from '../api/questions';
import { SPEC, SKILL_ORDER, type Mix } from './spec';

export type Rng = () => number;
/** mulberry32: small seeded generator so builds are reproducible in tests. */
export const seeded = (a: number): Rng => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export const shuffle = <T>(a: T[], rng: Rng = Math.random): T[] => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export interface BuildOpts { noActive: boolean; seen: Set<string>; rng?: Rng }

const DIFFRANK: Record<Diff, number> = { E: 0, M: 1, H: 2 };
// College Board ships both "Cross-Text Connections" and "Cross-text Connections"
export const skillKey = (q: Meta) => (q.skill || '').trim().toLowerCase();
const skillRank = (q: Meta) => {
  const order = SKILL_ORDER[q.dom];
  if (!order) return 0;
  const i = order.indexOf(skillKey(q));
  return i === -1 ? order.length : i;
};

export const pool = (index: Index, sec: Section, noActive: boolean): Meta[] =>
  noActive ? index[sec].filter(q => !q.live) : index[sec];

/** Pick n, unseen first, honouring a difficulty mix and topping up from other tiers. */
export function draw(p: Meta[], n: number, mix: Mix, seen: Set<string>, rng: Rng = Math.random): Meta[] {
  const by: Record<Diff, Meta[]> = { E: [], M: [], H: [] };
  for (const q of p) by[q.diff]?.push(q);
  for (const k of ['E', 'M', 'H'] as Diff[]) {
    const s = shuffle(by[k], rng);
    by[k] = s.filter(q => !seen.has(q.id)).concat(s.filter(q => seen.has(q.id)));
  }
  const want = { E: Math.round(n * mix.E), M: Math.round(n * mix.M), H: Math.round(n * mix.H) };
  want.M += n - want.E - want.M - want.H;          // rounding slack lands on medium
  const out: Meta[] = [];
  for (const k of ['E', 'M', 'H'] as Diff[]) out.push(...by[k].splice(0, Math.max(0, want[k])));
  const rest = [...by.E, ...by.M, ...by.H].sort((a, b) => +seen.has(a.id) - +seen.has(b.id));
  while (out.length < n && rest.length) out.push(rest.shift()!);
  return out;
}

/** One module: blueprint domain counts, grid-in split and order. `short` when the pool could not fill it. */
export function buildModule(index: Index, sec: Section, mix: Mix, o: BuildOpts): { qs: Meta[]; short: boolean } {
  const spec = SPEC[sec], all = pool(index, sec, o.noActive), rng = o.rng ?? Math.random, out: Meta[] = [];
  for (const dom of spec.order) {
    const dp = all.filter(q => q.dom === dom);
    let picked: Meta[];
    if (spec.spr) {
      const nSpr = spec.spr[dom];
      const spr = draw(dp.filter(q => q.type === 'spr'), nSpr, mix, o.seen, rng);
      picked = spr.concat(draw(dp.filter(q => q.type === 'mcq'), spec.doms[dom] - spr.length, mix, o.seen, rng));
    } else {
      picked = draw(dp, spec.doms[dom], mix, o.seen, rng);
    }
    if (sec === 'rw') picked.sort((a, b) => skillRank(a) - skillRank(b) || DIFFRANK[a.diff] - DIFFRANK[b.diff]);
    out.push(...picked);
  }
  // math is domain-mixed, roughly ascending difficulty, grid-ins last
  if (sec === 'math') out.sort((a, b) => +(a.type === 'spr') - +(b.type === 'spr') || DIFFRANK[a.diff] - DIFFRANK[b.diff]);
  return { qs: out, short: out.length < spec.qs };
}

export function skillsByDomain(index: Index, sec: Section, doms: string[], noActive: boolean) {
  const acc: Record<string, Record<string, { label: string; n: number }>> = {};
  for (const q of pool(index, sec, noActive)) {
    if (!doms.includes(q.dom)) continue;
    ((acc[q.dom] ||= {})[skillKey(q)] ||= { label: (q.skill || '').trim(), n: 0 }).n++;
  }
  const out: Record<string, [string, { label: string; n: number }][]> = {};
  for (const dom in acc) out[dom] = Object.entries(acc[dom]).sort((a, b) => b[1].n - a[1].n);
  return out;
}

export function customPool(index: Index, sec: Section, doms: string[], diffs: Diff[], skills: string[], noActive: boolean) {
  return pool(index, sec, noActive).filter(q =>
    doms.includes(q.dom) && diffs.includes(q.diff) && (!skills.length || skills.includes(skillKey(q))));
}

export function buildCustom(index: Index, sec: Section, doms: string[], diffs: Diff[], n: number, skills: string[], o: BuildOpts): Meta[] {
  const p = customPool(index, sec, doms, diffs, skills, o.noActive);
  const mix = { E: 0, M: 0, H: 0 };
  for (const d of diffs) mix[d] = 1 / diffs.length;
  return shuffle(draw(p, Math.min(n, p.length), mix, o.seen, o.rng), o.rng);
}

/** Module 2 approximation: 60% or more on Module 1 routes to the harder set. */
export const routeModule2 = (correct: number, total: number): 'm2hard' | 'm2easy' =>
  total > 0 && correct / total >= 0.6 ? 'm2hard' : 'm2easy';
