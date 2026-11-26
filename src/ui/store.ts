import { signal } from '@preact/signals';
import { fetchIndex, hydrate, type Index, type Meta, type Question, type Section, type Diff } from '../api/questions';
import { Idb, loadIndex } from '../store/idb';
import { loadState, saveState, trimOld, migrate, STATE_KEY, type AppState, type Mode, type Answer, type SessionRecord } from '../store/state';
import { buildModule, buildCustom } from '../bank/build';
import { MIX } from '../bank/spec';
import { applyAnswers, dueItems } from '../review/schedule';
import {
  startSession, setStageQs, needsQs, currentStage, tick, finish, fullTestPlan, modulePlan, drillPlan,
  type Session, type Stage,
} from '../session/machine';
import { snapshot, restore, peek } from '../session/resume';
import { buildToday } from '../trainer/today';
import { setTag, type Tag } from '../trainer/tags';

export const idb = new Idb();
const SESSION_KEY = 'sat-remake.session';

export type Screen = 'boot' | 'error' | 'menu' | 'session' | 'results' | 'vocab' | 'skills';
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
/** Add to the notice, so a storage warning raised on the way is not overwritten. */
export const say = (m: string) => { notice.value = notice.value ? notice.value + ' ' + m : m; };
/** Ref that focuses a dialog's first button when it opens: Preact does not polyfill autoFocus. */
export const focusOnMount = (el: HTMLElement | null) => el?.focus();
/** onKeyDown for a modal dialog: Tab and Shift+Tab wrap around inside it. */
export function trapTab(e: KeyboardEvent) {
  if (e.key !== 'Tab') return;
  const f = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1], at = document.activeElement;
  if (!f.includes(at as HTMLElement) || at === (e.shiftKey ? first : last)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
}
export const fatal = signal<{ msg: string; retry: () => void; label?: string } | null>(null);

/** What is saved right now, which another tab may have changed. Null when unreadable. */
function stored(): AppState | null {
  try { const raw = localStorage.getItem(STATE_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch { return null; }
}

/** Apply a change on top of the saved state, so two open tabs add to each other's history
 *  instead of overwriting it. After a failed save, memory is newer than storage, so it wins. */
export function update(fn: (s: AppState) => AppState): boolean {
  const base = storageWarn.value ? state.value : stored() ?? state.value;
  state.value = fn(base);
  let ok = saveState(state.value).ok;
  if (!ok) {
    const t = trimOld(state.value, Date.now());
    if (t.dropped && saveState(t.state).ok) {
      state.value = t.state; ok = true;
      notice.value = `Storage was full, so ${t.dropped} answer${t.dropped === 1 ? '' : 's'} older than a year came out of the detailed log to make room. Session history, mistakes and vocab are kept.`;
    }
  }
  storageWarn.value = !ok;
  return ok;
}
addEventListener('storage', e => { if (e.key === STATE_KEY && !storageWarn.value) state.value = loadState(); });

/** Starting something new replaces a saved session; ask first. */
function okToReplace() {
  const saved = savedSession();
  return !saved || confirm(`Start something new? This replaces your saved session (${saved.label}) and its answers are not kept.`);
}

export const netMessage = (e: unknown, missing = 'there is no saved copy of the question list yet') => {
  if (!navigator.onLine) return `You appear to be offline, and ${missing}.`;
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
  // only the clock moves a session on by itself: say so, or the jump looks like a glitch
  if (fn === tick && (next.stage !== cur.stage || next.view !== cur.view))
    notice.value = cur.view === 'break' ? 'The break is over.' : 'Time is up, so this module was submitted.';
  // a results-view snapshot is never resumable, so complete() decides what happens to it
  if (next.view !== 'results' && (fn !== tick || ++ticks % 20 === 0)) persist(next);
  if (next.view === 'results') complete(next);
  else if (needsQs(next) && !loading.value) fillStage();
}

async function fillStage() {
  const s = session.value, st = s && currentStage(s);
  if (!s || !st || st.kind !== 'module' || st.qs || !index.value) return;
  // never repeat a question already in this session, even once the unseen pool runs out
  const exclude = new Set(s.stages.flatMap(x => x.kind === 'module' && x.qs ? x.qs.map(q => q.id) : []));
  const built = buildModule(index.value, st.sec, MIX[st.route ?? 'm1'], { ...opts(), exclude });
  if (!built.qs.length) { fatal.value = { msg: 'There are no questions left to build this module from.', label: 'Finish here',
    // keep what was already answered (a finished Module 1); with nothing answered, just leave
    retry: () => { fatal.value = null; const cur = session.value!;
      if (cur.stages.some(x => x.kind === 'module' && x.qs)) complete(cur); else { session.value = null; discardSaved(); screen.value = 'menu'; } } }; return; }
  try {
    const qs = await getQs(built.qs, `Loading ${st.label}`);
    markSeen(built.qs);
    if (built.short) say(`This module has ${qs.length} questions instead of the usual number: the question pool ran short.`);
    session.value = setStageQs(session.value!, qs);
    persist(session.value);
  } catch (e) {
    fatal.value = { msg: netMessage(e, 'these questions are not saved on this device yet'), retry: () => { fatal.value = null; fillStage(); } };
  }
}

function begin(s: Session) {
  result.value = null; session.value = s; screen.value = 'session';
  if (needsQs(s)) fillStage(); else persist(s);
}

export const startFull = () => okToReplace() && begin(startSession('full', false, fullTestPlan(), Date.now()));
export const startModule = (sec: Section) => okToReplace() && begin(startSession('module', false, modulePlan(sec), Date.now()));

export async function startDrill(mode: Mode, metas: Meta[], mins: number | null, label: string, tutor: boolean, soft = false) {
  if (!metas.length) { notice.value = 'No questions match that selection.'; return; }
  if (!okToReplace()) return;
  try {
    const qs = await getQs(metas);
    markSeen(metas);
    begin(startSession(mode, tutor, drillPlan(qs, mins, label, soft), Date.now()));
  } catch (e) { notice.value = netMessage(e, 'these questions are not saved on this device yet'); }
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

export function startToday(mins: number) {
  if (!index.value) return;
  const { metas } = buildToday(index.value, state.value, mins, Date.now());
  startDrill('today', metas, mins, 'Today', state.value.settings.todayTutor, true);
}

/** Tag one answer, in the saved log and in the results on screen. */
export function tagAnswer(at: number, ext: string, tag: Tag | null) {
  update(s => ({ ...s, answers: setTag(s.answers, at, ext, tag) }));
  if (result.value) result.value = { ...result.value, answers: setTag(result.value.answers, at, ext, tag) };
}

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
  // drop the snapshot first: it frees space for the results
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
  const saved = update(st => {
    // finishing a kept copy again (after a failed save) must not record the results twice
    if (st.sessions.some(x => x.id === record.id)) return st;
    const r = applyAnswers(st.review, answers, now);
    added = r.added; cleared = r.cleared;
    return { ...st, answers: [...st.answers, ...answers], sessions: [record, ...st.sessions], review: r.review };
  });
  if (!saved) {
    // keep a resumable copy on the review page so the answers are not lost on reload
    persist({ ...s, view: 'review' });
    notice.value = 'Your browser would not save these results. Download a backup from the menu before closing this tab.';
  }
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
    let missing = false;
    const r = await restore(json, async exts => {
      const metas = exts.map(e => byExt.get(e));
      if (metas.some(m => !m)) { missing = true; return []; }
      return getQs(metas as Meta[], 'Restoring your session');
    }, Date.now());
    // it may hold results that never saved, so only the student deletes it (Discard it)
    if (missing) { notice.value = "That saved session can't be reopened: a question in it is no longer in the question list. It stays on the menu for a week; Discard it removes it now."; return; }
    if (!r) { notice.value = 'That saved session could not be restored.'; discardSaved(); return; }
    begin(r.session);
  } catch (e) { notice.value = netMessage(e); }
}

addEventListener('pagehide', () => { if (session.value) persist(session.value); });

// one clock for everything; tick() is a no-op outside a running question view
setInterval(() => { if (session.value && screen.value === 'session') act(tick); }, 250);
