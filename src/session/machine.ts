import type { Question, Section } from '../api/questions';
import { SPEC, DOMNAME } from '../bank/spec';
import { routeModule2 } from '../bank/build';
import { isCorrect } from '../score/check';
import type { Answer, Mode, SessionRecord } from '../store/state';

export type Route = 'm1' | 'm2hard' | 'm2easy';
export type Stage =
  | { kind: 'module'; sec: Section; label: string; mins: number | null; route?: Route; qs: Question[] | null; soft?: boolean }
  | { kind: 'break'; label: string; mins: number };
export type Resp = number | string | null;
export interface Hl { sti: string | null; stem: string | null }
export interface Session {
  mode: Mode; tutor: boolean; stages: Stage[]; stage: number; idx: number;
  view: 'q' | 'review' | 'break' | 'results';
  resp: Resp[][]; marked: boolean[][]; struck: number[][][]; hl: (Hl | null)[][]; checked: boolean[][]; time: number[][];
  remainingMs: number | null; clockAt: number | null; on: [number, number, number] | null;
  expired: boolean; abc: boolean; startedAt: number;
}

const MIN = 60000;
const RW_DOMS = new Set(['CAS', 'INI', 'SEC', 'EOI']);
export const secOf = (dom: string): Section => RW_DOMS.has(dom) ? 'rw' : 'math';

const mod = (sec: Section, label: string, route?: Route, qs: Question[] | null = null, mins: number | null = SPEC[sec].mins): Stage =>
  ({ kind: 'module', sec, label, mins, route, qs });

export const fullTestPlan = (): Stage[] => [
  mod('rw', 'Reading and Writing, Module 1', 'm1'),
  mod('rw', 'Reading and Writing, Module 2'),
  { kind: 'break', label: 'Break', mins: 10 },
  mod('math', 'Math, Module 1', 'm1'),
  mod('math', 'Math, Module 2'),
];
export const modulePlan = (sec: Section): Stage[] => [mod(sec, SPEC[sec].name + ' module', 'm1')];
/** `soft`: the clock counts down and shows, but running out does not end anything (Today). */
export const drillPlan = (qs: Question[], mins: number | null, label = 'Drill', soft = false): Stage[] =>
  [{ ...mod(qs.length ? secOf(qs[0].dom) : 'math', label, undefined, qs, mins), ...(soft ? { soft: true } : {}) } as Stage];

export const currentStage = (s: Session) => s.stages[s.stage];
export const currentQs = (s: Session) => { const st = currentStage(s); return st?.kind === 'module' ? st.qs : null; };
export const needsQs = (s: Session) => { const st = currentStage(s); return s.view !== 'results' && st?.kind === 'module' && !st.qs; };
const testDay = (m: Mode) => m === 'full' || m === 'module';

/** Copy of `outer` whose current-stage inner array has index `i` set to `v`. */
function put<T>(outer: T[][], st: number, i: number, v: T): T[][] {
  const o = outer.slice(); o[st] = outer[st].slice(); o[st][i] = v; return o;
}

export function startSession(mode: Mode, tutor: boolean, stages: Stage[], now: number): Session {
  const n = stages.length, blank = () => Array.from({ length: n }, () => [] as any[]);
  const s: Session = {
    mode, tutor: tutor && !testDay(mode), stages, stage: 0, idx: 0, view: 'q',
    resp: blank(), marked: blank(), struck: blank(), hl: blank(), checked: blank(), time: blank(),
    remainingMs: null, clockAt: null, on: null, expired: false, abc: false, startedAt: now,
  };
  const first = stages[0];
  return first.kind === 'module' && first.qs ? setStageQs(s, first.qs) : s;
}

export function setStageQs(s: Session, qs: Question[]): Session {
  const st = currentStage(s);
  if (st.kind !== 'module') return s;
  const stages = s.stages.slice(); stages[s.stage] = { ...st, qs };
  const fill = <T,>(outer: T[][], v: () => T) => { const o = outer.slice(); o[s.stage] = qs.map(v); return o; };
  return {
    ...s, stages, idx: 0, view: 'q', expired: false, clockAt: null, on: null,
    remainingMs: st.mins == null ? null : st.mins * MIN,
    resp: fill(s.resp, () => null), marked: fill(s.marked, () => false), struck: fill(s.struck, () => [] as number[]),
    hl: fill(s.hl, () => null), checked: fill(s.checked, () => false), time: fill(s.time, () => 0),
  };
}

/** Advance the clock and charge elapsed time to the question on screen. The first tick
 *  after a start or resume only sets the reference point, so loading and closed tabs cost nothing.
 *  When a timed module runs out it is submitted. */
// the UI ticks every 250 ms; a gap over a minute means the laptop slept or the tab was in the background
const MAX_GAP = 60000;

export function tick(s: Session, now: number): Session {
  if (s.view === 'results' || needsQs(s)) return s;
  let n: Session = { ...s };
  // a checked question is done: time spent reading its explanation is not answer time
  if (s.on && s.view === 'q' && s.time[s.on[0]] && !s.checked[s.on[0]]?.[s.on[1]] && now - s.on[2] <= MAX_GAP)
    n.time = put(s.time, s.on[0], s.on[1], s.time[s.on[0]][s.on[1]] + now - s.on[2]);
  n.on = s.view === 'q' ? [s.stage, s.idx, now] : null;
  if (n.remainingMs != null) {
    if (n.clockAt != null) n.remainingMs = Math.max(0, n.remainingMs - (now - n.clockAt));
    n.clockAt = now;
    const st = currentStage(n);
    if (n.remainingMs <= 0 && !n.expired && !(st.kind === 'module' && st.soft)) {
      // as on test day, the module is submitted when time runs out
      return submitModule({ ...n, expired: true }, now);
    }
  }
  return n;
}

export function goTo(s: Session, idx: number, now: number): Session {
  const n = tick(s, now), qs = currentQs(n);
  if (!qs || idx < 0 || idx >= qs.length) return n;
  return { ...n, idx, view: 'q', on: [n.stage, idx, now] };
}
export const toReview = (s: Session, now: number): Session => ({ ...tick(s, now), view: 'review', on: null });

const locked = (s: Session) => !!s.checked[s.stage]?.[s.idx];
export const answer = (s: Session, r: Resp): Session => locked(s) ? s : { ...s, resp: put(s.resp, s.stage, s.idx, r) };
export const toggleMark = (s: Session): Session => ({ ...s, marked: put(s.marked, s.stage, s.idx, !s.marked[s.stage][s.idx]) });
export const strike = (s: Session, opt: number): Session => {
  const cur = s.struck[s.stage][s.idx];
  return { ...s, struck: put(s.struck, s.stage, s.idx, cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt]) };
};
export const setHl = (s: Session, hl: Hl): Session => ({ ...s, hl: put(s.hl, s.stage, s.idx, hl) });
export const check = (s: Session): Session => {
  const r = s.resp[s.stage]?.[s.idx];
  return !s.tutor || r == null || r === '' ? s : { ...s, checked: put(s.checked, s.stage, s.idx, true) };
};
export const toggleAbc = (s: Session): Session => ({ ...s, abc: !s.abc });

const moduleCorrect = (s: Session, i: number) => {
  const st = s.stages[i];
  return st.kind === 'module' && st.qs ? st.qs.filter((q, j) => isCorrect(q, s.resp[i][j])).length : 0;
};

/** Submit the current module (or leave the break) and move to the next stage.
 *  A Module 2 takes its route from Module 1; the caller fills its questions. */
export function submitModule(s: Session, now: number): Session {
  const t = s.view === 'break' ? s : tick(s, now);
  const next = t.stage + 1;
  const base = { ...t, stage: next, idx: 0, on: null, clockAt: null, expired: false };
  if (next >= t.stages.length) return { ...base, stage: t.stage, view: 'results', remainingMs: null };
  const st = t.stages[next];
  if (st.kind === 'break') return { ...base, view: 'break', remainingMs: st.mins * MIN };
  const prev = t.stages[t.stage];
  if (!st.route && prev.kind === 'module' && prev.sec === st.sec && prev.qs) {
    const stages = t.stages.slice();
    stages[next] = { ...st, route: routeModule2(moduleCorrect(t, t.stage), prev.qs.length) };
    return { ...base, stages, view: 'q', remainingMs: null };
  }
  return { ...base, view: 'q', remainingMs: null };
}

export function finish(s: Session, now: number): { answers: Answer[]; record: SessionRecord } {
  const t = s.view === 'q' ? tick(s, now) : s;
  const answers: Answer[] = [];
  t.stages.forEach((st, i) => {
    if (st.kind !== 'module' || !st.qs) return;
    st.qs.forEach((q, j) => answers.push({
      qid: q.id, ext: q.ext, sec: secOf(q.dom), dom: q.dom, skill: q.skill, diff: q.diff,
      resp: t.resp[i][j] ?? null, ok: isCorrect(q, t.resp[i][j] ?? null), ms: t.time[i][j] || 0, mode: t.mode, at: now, timed: st.mins != null,
    }));
  });
  const doms: Record<string, [number, number]> = {};
  for (const a of answers) { const r = doms[DOMNAME[a.dom] ?? a.dom] ||= [0, 0]; r[1]++; if (a.ok) r[0]++; }
  const label = t.stages.filter(x => x.kind === 'module').map(x => x.label).join(' + ');
  return { answers, record: { id: String(now), at: now, label, correct: answers.filter(a => a.ok).length, total: answers.length, doms,
    mode: t.mode, ms: answers.reduce((p, a) => p + a.ms, 0) } };
}

export const fmt = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};

/** What the header clock shows. A soft clock (Today) never warns and says so once it runs out. */
export const clockView = (remainingMs: number, soft: boolean) =>
  soft && remainingMs <= 0 ? { text: "Time's up, keep going", low: false, over: true }
    : { text: fmt(remainingMs), low: !soft && remainingMs < 5 * 60000, over: false };
