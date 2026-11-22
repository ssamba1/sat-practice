import type { Index } from '../api/questions';

type Store = 'meta' | 'body';
export const INDEX_TTL = 7 * 24 * 3600 * 1000;   // re-check active flags weekly

/** Tiny IndexedDB wrapper. Every write resolves even on error (storage full),
 *  so a failed cache write never hangs the app. */
export class Idb {
  private db: Promise<IDBDatabase> | null = null;
  constructor(private name = 'sat-remake') {}

  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((res, rej) => {
      const rq = indexedDB.open(this.name, 1);
      rq.onupgradeneeded = () => {
        for (const s of ['meta', 'body']) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s);
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => { this.db = null; rej(rq.error); };
    });
  }
  private async os(store: Store, mode: IDBTransactionMode) {
    return (await this.open()).transaction(store, mode).objectStore(store);
  }
  async get(store: Store, key: string): Promise<any> {
    const s = await this.os(store, 'readonly');
    return new Promise(res => { const r = s.get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); });
  }
  async put(store: Store, key: string, val: unknown): Promise<void> {
    const s = await this.os(store, 'readwrite');
    return new Promise(res => { const r = s.put(val, key); r.onsuccess = r.onerror = () => res(); });
  }
  async getMany(store: Store, keys: string[]): Promise<Record<string, any>> {
    if (!keys.length) return {};
    const s = await this.os(store, 'readonly'), out: Record<string, any> = {};
    return new Promise(res => {
      let left = keys.length;
      for (const k of keys) {
        const r = s.get(k);
        r.onsuccess = () => { if (r.result) out[k] = r.result; if (!--left) res(out); };
        r.onerror = () => { if (!--left) res(out); };
      }
    });
  }
  async putMany(store: Store, entries: [string, unknown][]): Promise<void> {
    if (!entries.length) return;
    const s = await this.os(store, 'readwrite');
    return new Promise(res => {
      let left = entries.length;
      for (const [k, v] of entries) { const r = s.put(v, k); r.onsuccess = r.onerror = () => { if (!--left) res(); }; }
    });
  }
  async count(store: Store): Promise<number> {
    const s = await this.os(store, 'readonly');
    return new Promise(res => { const r = s.count(); r.onsuccess = () => res(r.result); r.onerror = () => res(0); });
  }
  async clear(store: Store): Promise<void> {
    const s = await this.os(store, 'readwrite');
    return new Promise(res => { const r = s.clear(); r.onsuccess = r.onerror = () => res(); });
  }
}

export async function loadIndex(db: Idb, fetcher: () => Promise<Index>, onMsg?: (m: string) => void):
  Promise<{ index: Index; from: 'cache' | 'network' | 'stale'; error?: unknown }> {
  const cached = await db.get('meta', 'index');
  if (cached && Date.now() - cached.ts < INDEX_TTL) return { index: cached.data, from: 'cache' };
  try {
    onMsg?.('Fetching the question index from College Board');
    const index = await fetcher();
    await db.put('meta', 'index', { ts: Date.now(), data: index });
    return { index, from: 'network' };
  } catch (error) {
    if (cached) return { index: cached.data, from: 'stale', error };
    throw error;
  }
}
