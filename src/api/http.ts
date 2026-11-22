/** fetch JSON, POSTing `body` when given, retrying with a linear backoff. */
export async function req<T = any>(url: string, body?: object, tries = 3, backoffMs = 400): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, body ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      } : {});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise(res => setTimeout(res, backoffMs * (i + 1)));
    }
  }
}

/** Bounded-concurrency map, so a big fetch keeps to a handful of sockets. */
export async function pooled<I, O>(items: I[], width: number, fn: (item: I) => Promise<O>,
  onProgress?: (done: number, total: number) => void): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      onProgress?.(++done, items.length);
    }
  }));
  return out;
}
