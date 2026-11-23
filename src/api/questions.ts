import { req, pooled } from './http';
import { fixMathML } from './mathml';
import { sanitizeHtml } from './sanitize';
import { GRIDINS } from '../data/gridins';

const BASE = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank';
export const API = {
  LIST: BASE + '/digital/get-questions',
  ITEM: BASE + '/digital/get-question',
  LOOKUP: BASE + '/lookup',
};
export const SECREQ = {
  rw: { test: 1, domain: 'INI,CAS,EOI,SEC', live: 'readingLiveItems' },
  math: { test: 2, domain: 'H,P,Q,S', live: 'mathLiveItems' },
} as const;

export type Section = 'rw' | 'math';
export type Diff = 'E' | 'M' | 'H';
export type QType = 'mcq' | 'spr';
export interface Meta { id: string; ext: string; dom: string; domName: string; skill: string; diff: Diff; live: 0 | 1; type: QType }
export interface Body { v: number; type: QType; sti: string; stem: string; opts: string[]; ans: string[]; rat: string }
export type Question = Meta & Body;
export type Index = Record<Section, Meta[]>;

export const BODY_SCHEMA = 3;   // 3: sanitized; older cached bodies are refetched
const GRID = new Set(GRIDINS);

export async function fetchIndex(): Promise<Index> {
  const look = await req<Record<string, string[]>>(API.LOOKUP);
  const out = {} as Index;
  for (const sec of ['rw', 'math'] as Section[]) {
    const p = SECREQ[sec];
    const live = new Set(look[p.live] || []);
    const rows = await req<any[]>(API.LIST, { asmtEventId: 99, test: p.test, domain: p.domain });
    out[sec] = rows.filter(m => m.external_id).map(m => ({
      id: m.questionId, ext: m.external_id, dom: m.primary_class_cd, domName: m.primary_class_cd_desc,
      skill: m.skill_desc, diff: m.difficulty, live: live.has(m.external_id) ? 1 : 0,
      // metadata has no question type: seed from the grid-in list, hydrate corrects it
      type: GRID.has(m.questionId) ? 'spr' : 'mcq',
    }));
  }
  return out;
}

export const clean = (html: string) => sanitizeHtml(fixMathML(html));

export function normalise(d: any): Body {
  return {
    v: BODY_SCHEMA,
    type: d.type || 'mcq',
    sti: clean(d.stimulus || ''),
    stem: clean(d.stem || ''),
    opts: (d.answerOptions || []).map((o: any) => clean(o.content || '')),
    ans: d.correct_answer || [],
    rat: clean(d.rationale || ''),
  };
}

export interface BodyCache {
  getMany(store: 'body', keys: string[]): Promise<Record<string, any>>;
  putMany(store: 'body', entries: [string, any][]): Promise<void>;
}

const MEM = new Map<string, Body>();
export const memBodies = MEM;

/** Attach content to index entries, fetching only what is not cached. Corrects
 *  each entry's type from its body; returns true in `drift` when any changed. */
export async function hydrate(entries: Meta[], cache: BodyCache,
  onProgress?: (done: number, total: number) => void): Promise<{ qs: Question[]; drift: boolean }> {
  const missing = entries.filter(e => !MEM.has(e.ext));
  if (missing.length) {
    const stored = await cache.getMany('body', missing.map(e => e.ext));
    for (const [k, v] of Object.entries(stored)) if (v && v.v === BODY_SCHEMA) MEM.set(k, v);
  }
  const need = entries.filter(e => !MEM.has(e.ext));
  let done = entries.length - need.length;
  onProgress?.(done, entries.length);
  if (need.length) {
    const got = await pooled(need, 6, async e => {
      const body = normalise(await req(API.ITEM, { external_id: e.ext }));
      MEM.set(e.ext, body);
      return [e.ext, body] as [string, Body];
    }, () => onProgress?.(++done, entries.length));
    await cache.putMany('body', got);
  }
  let drift = false;
  for (const e of entries) {
    const t = MEM.get(e.ext)!.type;
    if (t !== e.type) { e.type = t; drift = true; }
  }
  return { qs: entries.map(e => ({ ...e, ...MEM.get(e.ext)! })), drift };
}
