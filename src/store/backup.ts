import { migrate, type AppState, type SessionRecord } from './state';
import type { ReviewItem } from '../review/schedule';

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);

export const backupJson = (s: AppState, now: number) => JSON.stringify({ app: 'sat-remake', v: 1, at: now, state: s });

export function importBackup(json: unknown): AppState | Error {
  if (!isObj(json) || json.app !== 'sat-remake' || !isObj(json.state)) return new Error('This is not a backup from this app.');
  return migrate(json.state);
}

export type Imported = Partial<Pick<AppState, 'review' | 'seen' | 'vocab' | 'sessions'>> & { settings?: { noActive?: boolean; tutor?: boolean } };

/** ModuleDrill backup: {moduledrill: 1, at, data: {'satsim.<key>': '<json string>'}}.
 *  It kept no per-question results, so only mistakes, seen ids, vocab, session totals and settings come across. */
export function importModuleDrill(json: unknown, now: number): { state: Imported; report: string[] } | Error {
  if (!isObj(json) || json.moduledrill !== 1 || !isObj(json.data)) return new Error('This is not a ModuleDrill backup.');
  const get = (k: string) => { try { return JSON.parse(json.data['satsim.' + k]); } catch { return undefined; } };
  const state: Imported = {}, report: string[] = [];

  const missed = get('missed');
  if (isObj(missed) && isObj(missed.m)) {
    const review: Record<string, ReviewItem> = {};
    for (const [ext, rec] of Object.entries(missed.m as Record<string, any>)) {
      if (!Array.isArray(rec)) continue;
      review[ext] = { sec: rec[0] === 1 ? 'math' : 'rw', stage: 0, due: now, okDays: [], misses: +rec[1] || 1, lastMiss: +rec[2] || 0 };
    }
    state.review = review;
    report.push(`${Object.keys(review).length} mistakes, all due for review now`);
  }
  const seen = get('seen');
  if (Array.isArray(seen)) { state.seen = seen.filter(x => typeof x === 'string'); report.push(`${state.seen.length} questions you had already seen`); }
  const vocab = get('vocab');
  if (isObj(vocab) && isObj(vocab.w)) {
    state.vocab = Object.fromEntries(Object.entries(vocab.w).filter(([, v]) => Array.isArray(v) && v.length === 2)) as AppState['vocab'];
    report.push(`progress on ${Object.keys(state.vocab).length} vocabulary words`);
  }
  const hist = get('history');
  if (Array.isArray(hist)) {
    state.sessions = hist.filter(isObj).map((h, i): SessionRecord => ({
      id: 'md-' + i, at: Date.parse(h.when) || now, label: String(h.what || 'ModuleDrill session'),
      correct: +h.correct || 0, total: +h.total || 0, doms: isObj(h.doms) ? h.doms : {}, legacy: true,
    }));
    report.push(`${state.sessions.length} past sessions (totals only)`);
  }
  const settings: Imported['settings'] = {};
  const na = get('noActive'), tu = get('tutor');
  if (typeof na === 'boolean') settings.noActive = na;
  if (typeof tu === 'boolean') settings.tutor = tu;
  if (Object.keys(settings).length) state.settings = settings;
  return { state, report };
}

/** Add imported data to what is already here. Nothing existing is dropped. */
export function mergeImported(cur: AppState, imp: Imported): AppState {
  const review = { ...cur.review };
  for (const [ext, r] of Object.entries(imp.review ?? {})) if (!review[ext] || review[ext].lastMiss < r.lastMiss) review[ext] = r;
  return {
    ...cur,
    review,
    seen: [...new Set([...cur.seen, ...(imp.seen ?? [])])],
    vocab: { ...(imp.vocab ?? {}), ...cur.vocab },
    sessions: [...cur.sessions, ...(imp.sessions ?? [])].sort((a, b) => b.at - a.at),
    settings: { ...cur.settings, ...(imp.settings ?? {}) },
  };
}
