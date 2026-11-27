import { req, pooled } from './http';
import { fixMathML } from './mathml';
import { sanitizeHtml } from './sanitize';
import { GRIDINS, IBN_GRIDINS } from '../data/gridins';

const BASE = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank';
export const API = {
  LIST: BASE + '/digital/get-questions',
  ITEM: BASE + '/digital/get-question',
  LOOKUP: BASE + '/lookup',
};
// Older math questions have an IBN instead of an external_id and are served from here.
export const ibnUrl = (ibn: string) => `https://saic.collegeboard.org/disclosed/${encodeURIComponent(ibn)}.json`;
export const isIbn = (ext: string) => /^\d+-DC$/.test(ext);
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
const GRID = new Set([...GRIDINS, ...IBN_GRIDINS]);
// the trainer weights by difficulty and drops answers without one, so an unknown code is left out
export const DIFFS = ['E', 'M', 'H'];

export async function fetchIndex(): Promise<Index> {
  const look = await req<Record<string, string[]>>(API.LOOKUP);
  const out = {} as Index;
  for (const sec of ['rw', 'math'] as Section[]) {
    const p = SECREQ[sec];
    const live = new Set(look[p.live] || []);
    const rows = await req<any[]>(API.LIST, { asmtEventId: 99, test: p.test, domain: p.domain });
    out[sec] = rows.filter(m => (m.external_id || m.ibn) && DIFFS.includes(m.difficulty)).map(m => ({
      id: m.questionId, ext: m.external_id || m.ibn, dom: m.primary_class_cd, domName: m.primary_class_cd_desc,
      skill: String(m.skill_desc ?? ''), diff: m.difficulty, live: live.has(m.external_id) ? 1 : 0,
      // metadata has no question type: seed from the grid-in list, hydrate corrects it
      type: GRID.has(m.questionId) ? 'spr' : 'mcq',
    }));
    // an empty list would empty every module for a week; keep the cached index instead
    if (!out[sec].length) throw new Error(`College Board returned no ${sec === 'rw' ? 'Reading and Writing' : 'Math'} questions`);
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

const WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11 };
const DEN: Record<string, number> = { half: 2, halves: 2, third: 3, thirds: 3, fourth: 4, fourths: 4, quarter: 4, quarters: 4, fifth: 5, fifths: 5,
  sixth: 6, sixths: 6, seventh: 7, sevenths: 7, eighth: 8, eighths: 8, ninth: 9, ninths: 9, tenth: 10, tenths: 10 };
function keyValue(p: string): string | null {
  p = p.trim().replace(/^the fraction /, '');
  const neg = /^negative /.test(p) ? '-' : '';
  p = p.replace(/^negative /, '');
  if (/^\d+(\.\d+)?$|^\.\d+$/.test(p)) return neg + p;
  let m = /^(\d+) over (\d+)$/.exec(p);
  if (m) return `${neg}${m[1]}/${m[2]}`;
  m = /^(\w+) (\w+)$/.exec(p);
  return m && WORD[m[1]] && DEN[m[2]] ? `${neg}${WORD[m[1]]}/${DEN[m[2]]}` : null;
}

/** An IBN grid-in has no key field; its explanation opens "The correct answer is X."
 *  Fractions are images whose alt text says "three halves" or "7 over 6". An unreadable
 *  key gives [] (every answer scored wrong) rather than a guessed one. */
export function sprKey(html: string): string[] {
  const text = html.replace(/<img[^>]*\balt="([^"]*)"[^>]*>/g, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const m = /The correct answer is (.*?)\s?\.(?:\s|$)/.exec(text);
  if (!m) return [];
  const vals = m[1].replace(/^either /, '').replace(/(\d),(\d{3})\b/g, '$1$2').split(/\s*,\s*(?:or\s+)?|\s+or\s+/).map(keyValue);
  return vals.every(v => v !== null) ? vals as string[] : [];
}

export function normaliseIbn(d: any): Body {
  const a = d.answer || {}, spr = a.style === 'SPR', rat = a.rationale || '';
  const letter = a.correct_choice || (/Choice ([A-D]) is correct/i.exec(rat) || [])[1] || '';
  return {
    v: BODY_SCHEMA, type: spr ? 'spr' : 'mcq', sti: clean(d.body || ''), stem: clean(d.prompt || ''),
    opts: spr ? [] : ['a', 'b', 'c', 'd'].map(k => clean(a.choices?.[k]?.body || '')),
    ans: spr ? sprKey(rat) : letter ? [letter.toUpperCase()] : [], rat: clean(rat),
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
      const body = isIbn(e.ext) ? normaliseIbn((await req<any[]>(ibnUrl(e.ext)))[0])
        : normalise(await req(API.ITEM, { external_id: e.ext }));
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
