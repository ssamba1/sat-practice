import { signal } from '@preact/signals';
import { fetchIndex, hydrate, type Index, type Meta, type Question, type Section, type Diff } from '../api/questions';
import { Idb, loadIndex } from '../store/idb';
import { loadState, saveState, type AppState, type Mode, type Answer, type SessionRecord } from '../store/state';
import { buildModule, buildCustom } from '../bank/build';
import { MIX } from '../bank/spec';
import { applyAnswers, dueItems } from '../review/schedule';
import {
  startSession, setStageQs, needsQs, currentStage, tick, finish, fullTestPlan, modulePlan, drillPlan,
  type Session, type Stage,
} from '../session/machine';
import { snapshot, restore, peek } from '../session/resume';

export const idb = new Idb();
const SESSION_KEY = 'sat-remake.session';

export type Screen = 'boot' | 'error' | 'menu' | 'session' | 'results' | 'vocab' | 'import';
export interface Result {
  answers: Answer[]; record: SessionRecord; budgetMs: number | null; qs: Question[];
  added: number; cleared: number; mode: Mode;
}

export const state = signal<AppState>(loadState());
export const index = signal<Index | null>(null);
export const indexStale = signal(false);
export const screen = signal<Screen>('boot');
export const bootMsg = signal('Loading the question index');
export const bootError = signal<string | null>(null);
export const session = signal<Session | null>(null);
export const result = signal<Result | null>(null);
export const storageWarn = signal(false);
export const loading = signal<{ msg: string; done: number; total: number } | null>(null);
export const notice = signal<string | null>(null);
export const fatal = signal<{ msg: string; retry: () => void } | null>(null);

export function update(fn: (s: AppState) => AppState) {
  state.value = fn(state.value);
  storageWarn.value = !saveState(state.value).ok;
}

export const netMessage = (e: unknown) => {
  if (!navigator.onLine) return 'You appear to be offline, and there is no saved copy of the question index yet.';
  return `College Board's question bank did not respond (${e instanceof Error ? e.message : String(e)}).`;
};

export async function boot() {
  screen.value = 'boot'; bootError.value = null;
  try {
    const r = await loadIndex(idb, fetchIndex, m => { bootMsg.value = m; });
    index.value = r.index; indexStale.value = r.from === 'stale';
    screen.value = 'menu';
  } catch (e) {
    bootError.value = netMessage(e);
    screen.value = 'error';
  }
}

// ---- questions --------------------------------------------------------------

const metaByExt = () => {
  const m = new Map<string, Meta>();
  for (const sec of ['rw', 'math'] as Section[]) for (const q of index.value?.[sec] ?? []) m.set(q.ext, q);
  return m;
};

async function getQs(metas: Meta[], msg = 'Loading questions'): Promise<Question[]> {
  loading.value = { msg, done: 0, total: metas.length };
  try {
    const { qs, drift } = await hydrate(metas, idb, (done, total) => { loading.value = { msg, done, total }; });
    // keep the stored timestamp: a bundle's index must stay stale so the live bank wins later
    if (drift && index.value) { const c = await idb.get('meta', 'index'); idb.put('meta', 'index', { ts: c?.ts ?? 0, data: index.value }); }
    return qs;
  } finally { loading.value = null; }
}

const markSeen = (metas: Meta[]) => update(s => ({ ...s, seen: [...new Set([...s.seen, ...metas.map(q => q.id)])] }));
const opts = () => ({ noActive: state.value.settings.noActive, seen: new Set(state.value.seen) });

// ---- session lifecycle ------------------------------------------------------

let ticks = 0;
function persist(s: Session) {
  try { localStorage.setItem(SESSION_KEY, snapshot(s, Date.now())); } catch { storageWarn.value = true; }
}

/** Apply a transition. Fills questions for a stage that needs them and wraps up at results. */
export function act(fn: (s: Session, now: number) => Session) {
  const cur = session.value;
  if (!cur) return;
  const next = fn(cur, Date.now());
  if (next === cur) return;
  session.value = next;
  if (fn !== tick || ++ticks % 20 === 0) persist(next);
  if (next.view === 'results') complete(next);
  else if (needsQs(next) && !loading.value) fillStage();
}

async function fillStage() {
  const s = session.value, st = s && currentStage(s);
  if (!s || !st || st.kind !== 'module' || st.qs || !index.value) return;
  const built = buildModule(index.value, st.sec, MIX[st.route ?? 'm1'], opts());
  if (!built.qs.length) { fatal.value = { msg: 'There are no questions left to build this module from.', retry: exitSession }; return; }
  try {
    const qs = await getQs(built.qs, `Loading ${st.label}`);
    markSeen(built.qs);
    if (built.short) notice.value = `This module has ${qs.length} questions instead of the usual number: the question pool ran short.`;
    session.value = setStageQs(session.value!, qs);
    persist(session.value);
  } catch (e) {
    fatal.value = { msg: netMessage(e), retry: () => { fatal.value = null; fillStage(); } };
  }
}

function begin(s: Session) {
  result.value = null; session.value = s; screen.value = 'session';
  if (needsQs(s)) fillStage(); else persist(s);
}

export const startFull = () => begin(startSession('full', false, fullTestPlan(), Date.now()));
export const startModule = (sec: Section) => begin(startSession('module', false, modulePlan(sec), Date.now()));

export async function startDrill(mode: Mode, metas: Meta[], mins: number | null, label: string, tutor: boolean) {
  if (!metas.length) { notice.value = 'No questions match that selection.'; return; }
  try {
    const qs = await getQs(metas);
    markSeen(metas);
    begin(startSession(mode, tutor, drillPlan(qs, mins, label), Date.now()));
  } catch (e) { notice.value = netMessage(e); }
}

export function startCustom(sec: Section, doms: string[], diffs: Diff[], n: number, skills: string[], mins: number | null, tutor: boolean) {
  if (!index.value) return;
  startDrill('custom', buildCustom(index.value, sec, doms, diffs, n, skills, opts()), mins, 'Custom drill', tutor);
}

/** Review queue: due items first, then the rest, newest miss first. */
export function mistakeMetas(limit: number): Meta[] {
  const rev = state.value.review, byExt = metaByExt(), now = Date.now();
  const due = dueItems(rev, now);
  const rest = Object.keys(rev).filter(k => !due.includes(k)).sort((a, b) => rev[b].lastMiss - rev[a].lastMiss);
  return [...due, ...rest].map(e => byExt.get(e)).filter((m): m is Meta => !!m).slice(0, limit);
}
export const startMistakes = (n: number, tutor: boolean) => startDrill('mistakes', mistakeMetas(n), null, 'Your mistakes', tutor);

export function startRetry(exts: string[], tutor: boolean) {
  const byExt = metaByExt();
  startDrill('retry', exts.map(e => byExt.get(e)).filter((m): m is Meta => !!m), null, 'Retry: missed questions', tutor);
}

function totalMins(stages: Stage[]) {
  let mins = 0;
  for (const st of stages) if (st.kind === 'module') { if (st.mins == null) return null; mins += st.mins; }
  return mins;
}

function complete(s: Session) {
  const now = Date.now();
  const { answers, record } = finish(s, now);
  const qs = s.stages.flatMap(st => st.kind === 'module' && st.qs ? st.qs : []);
  const mins = totalMins(s.stages);
  const budgetMs = mins == null || !answers.length ? null : mins * 60000 / answers.length;
  let added = 0, cleared = 0;
  update(st => {
    const r = applyAnswers(st.review, answers, now);
    added = r.added; cleared = r.cleared;
    return { ...st, answers: [...st.answers, ...answers], sessions: [record, ...st.sessions], review: r.review };
  });
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
  result.value = { answers, record, budgetMs, qs, added, cleared, mode: s.mode };
  session.value = null;
  screen.value = 'results';
}

export function exitSession() {
  if (session.value) persist(session.value);
  fatal.value = null; session.value = null; screen.value = 'menu';
}
export function discardSaved() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
}

export const savedSession = () => {
  try { return peek(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};

export async function resumeSaved() {
  let json: string | null = null;
  try { json = localStorage.getItem(SESSION_KEY); } catch { /* storage blocked */ }
  if (!json) return;
  const byExt = metaByExt();
  try {
    const r = await restore(json, async exts => {
      const metas = exts.map(e => byExt.get(e));
      return metas.some(m => !m) ? [] : getQs(metas as Meta[], 'Restoring your session');
    }, Date.now());
    if (!r) { notice.value = 'That saved session could not be restored.'; discardSaved(); return; }
    begin(r.session);
  } catch (e) { notice.value = netMessage(e); }
}

addEventListener('pagehide', () => { if (session.value) persist(session.value); });

// one clock for everything; tick() is a no-op outside a running question view
setInterval(() => { if (session.value && screen.value === 'session') act(tick); }, 250);
