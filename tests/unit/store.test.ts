import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Idb, loadIndex, INDEX_TTL, INDEX_V } from '../../src/store/idb';
import { loadState, saveState, migrate, defaultState, STATE_KEY } from '../../src/store/state';
import * as q from '../../src/api/questions';

let n = 0;
const freshDb = () => new Idb('test-' + n++);
const IDX = { rw: [], math: [] };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Idb', () => {
  it('round-trips values and counts', async () => {
    const db = freshDb();
    await db.put('meta', 'a', 1);
    await db.putMany('body', [['x', { v: 1 }], ['y', { v: 2 }]]);
    expect(await db.get('meta', 'a')).toBe(1);
    expect(await db.getMany('body', ['x', 'y', 'z'])).toEqual({ x: { v: 1 }, y: { v: 2 } });
    expect(await db.count('body')).toBe(2);
    await db.clear('body');
    expect(await db.count('body')).toBe(0);
  });
});

describe('loadIndex', () => {
  it('uses a cached index inside the TTL without fetching', async () => {
    const db = freshDb();
    await db.put('meta', 'index', { ts: Date.now(), v: INDEX_V, data: IDX });
    const spy = vi.spyOn(q, 'fetchIndex');
    expect((await loadIndex(db, q.fetchIndex)).from).toBe('cache');
    expect(spy).not.toHaveBeenCalled();
  });
  it('refetches an expired index', async () => {
    const db = freshDb();
    await db.put('meta', 'index', { ts: Date.now() - INDEX_TTL - 1, data: IDX });
    const r = await loadIndex(db, async () => ({ rw: [], math: [] }));
    expect(r.from).toBe('network');
  });
  it('falls back to a stale cache when the network fails', async () => {
    const db = freshDb();
    await db.put('meta', 'index', { ts: 0, data: IDX });
    const r = await loadIndex(db, async () => { throw new Error('down'); });
    expect(r.from).toBe('stale');
  });
  it('throws when the network fails and nothing is cached', async () => {
    await expect(loadIndex(freshDb(), async () => { throw new Error('down'); })).rejects.toThrow('down');
  });
});

describe('hydrate through Idb', () => {
  it('serves cached bodies without fetching', async () => {
    const db = freshDb();
    const body = { v: q.BODY_SCHEMA, type: 'spr', sti: '', stem: 's', opts: [], ans: ['1'], rat: '' };
    await db.putMany('body', [['cached-ext', body]]);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('no network'); }));
    const meta = { id: 'i', ext: 'cached-ext', dom: 'H', domName: 'Algebra', skill: 's', diff: 'E' as const, live: 0 as const, type: 'mcq' as const };
    const { qs, drift } = await q.hydrate([meta], db);
    expect(qs[0].stem).toBe('s');
    expect(drift).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('app state', () => {
  it('migrates junk to defaults', () => {
    for (const raw of [null, 'garbage', 42, { v: 99 }]) expect(migrate(raw)).toEqual(defaultState());
  });
  it('keeps valid fields when one field is corrupt', () => {
    const s = defaultState();
    s.answers.push({ qid: 'q', ext: 'e', sec: 'rw', dom: 'CAS', skill: 'x', diff: 'E', resp: 0, ok: true, ms: 5, mode: 'custom', at: 1 });
    const out = migrate({ ...s, review: 'broken', seen: [1, 'a'] });
    expect(out.answers).toHaveLength(1);
    expect(out.review).toEqual({});
    expect(out.seen).toEqual(['a']);
  });
  it('round-trips through localStorage', () => {
    const s = defaultState(); s.seen.push('x'); s.settings.noActive = false;
    expect(saveState(s).ok).toBe(true);
    expect(loadState()).toEqual(s);
  });
  it('reads unparseable storage as defaults', () => {
    localStorage.setItem(STATE_KEY, '{half');
    expect(loadState()).toEqual(defaultState());
  });
  it('reports a failed save instead of throwing', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(saveState(defaultState())).toEqual({ ok: false });
  });
});
