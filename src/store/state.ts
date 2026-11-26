import type { Section, Diff } from '../api/questions';
import type { ReviewItem } from '../review/schedule';

export type Mode = 'full' | 'module' | 'custom' | 'mistakes' | 'retry' | 'today';
export interface Answer {
  qid: string; ext: string; sec: Section; dom: string; skill: string; diff: Diff;
  resp: number | string | null; ok: boolean; ms: number; mode: Mode; at: number; tag?: string;
  timed?: boolean;   // the stage had a clock; missing on answers from before release 2
}
export interface SessionRecord {
  id: string; at: number; label: string; correct: number; total: number;
  doms: Record<string, [number, number]>; legacy?: true; mode?: Mode; ms?: number;
}
export interface CalcPos { x: number; y: number; w: number; h: number }
export interface Settings {
  noActive: boolean; tutor: boolean; theme: 'system' | 'light' | 'dark'; calc?: CalcPos;
  todayTutor: boolean; goal?: { testDate?: string };
}
export interface AppState {
  v: 1; answers: Answer[]; sessions: SessionRecord[]; seen: string[];
  review: Record<string, ReviewItem>; vocab: Record<string, [number, number]>; settings: Settings;
}

export const STATE_KEY = 'sat-remake.state';

export const defaultState = (): AppState => ({
  v: 1, answers: [], sessions: [], seen: [], review: {}, vocab: {},
  settings: { noActive: true, tutor: false, theme: 'system', todayTutor: true },
});

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);
const arr = (x: unknown, ok: (e: any) => boolean) => Array.isArray(x) ? x.filter(ok) : [];
const dict = (x: unknown, ok: (e: any) => boolean) =>
  isObj(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => ok(v))) : {};

/** Turn whatever is in storage into a valid state. A broken field falls back to its
 *  default on its own, so one corrupt key never costs the rest of the history. */
export function migrate(raw: unknown): AppState {
  const d = defaultState();
  if (!isObj(raw) || raw.v !== 1) return d;
  const s = isObj(raw.settings) ? raw.settings : {};
  return {
    v: 1,
    // the trainer reads skill, diff, time and ms from every answer, so a malformed one is dropped
    answers: arr(raw.answers, a => isObj(a) && typeof a.qid === 'string' && typeof a.ok === 'boolean' && typeof a.skill === 'string'
      && ['E', 'M', 'H'].includes(a.diff) && Number.isFinite(a.at) && Number.isFinite(a.ms)),
    sessions: arr(raw.sessions, r => isObj(r) && typeof r.total === 'number'),
    seen: arr(raw.seen, x => typeof x === 'string'),
    review: dict(raw.review, r => isObj(r) && typeof r.due === 'number' && Array.isArray(r.okDays)),
    vocab: dict(raw.vocab, v => Array.isArray(v) && v.length === 2),
    settings: {
      noActive: typeof s.noActive === 'boolean' ? s.noActive : d.settings.noActive,
      tutor: typeof s.tutor === 'boolean' ? s.tutor : d.settings.tutor,
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : d.settings.theme,
      todayTutor: typeof s.todayTutor === 'boolean' ? s.todayTutor : d.settings.todayTutor,
      ...(isObj(s.calc) ? { calc: s.calc as CalcPos } : {}),
      ...(isObj(s.goal) && typeof s.goal.testDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.goal.testDate) ? { goal: { testDate: s.goal.testDate } } : {}),
    },
  };
}

export function loadState(): AppState {
  try { return migrate(JSON.parse(localStorage.getItem(STATE_KEY) || 'null')); } catch { return defaultState(); }
}

export function saveState(s: AppState): { ok: boolean } {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); return { ok: true }; } catch { return { ok: false }; }
}

const YEAR = 365 * 864e5;
/** Room for new results when storage is full: answers over a year old carry almost no weight
 *  (30-day half-life), so they go first. Sessions, mistakes and vocab are kept. */
export function trimOld(s: AppState, now: number) {
  const answers = s.answers.filter(a => now - a.at <= YEAR);
  return { state: { ...s, answers }, dropped: s.answers.length - answers.length };
}
