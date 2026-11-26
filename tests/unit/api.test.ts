import { describe, it, expect, vi, afterEach } from 'vitest';
import { req, pooled } from '../../src/api/http';
import { fetchIndex, normalise, API, BODY_SCHEMA } from '../../src/api/questions';

afterEach(() => vi.unstubAllGlobals());
const ok = (v: unknown) => ({ ok: true, json: async () => v });

describe('req', () => {
  it('retries and returns the value on the third try', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b'))
      .mockResolvedValueOnce(ok({ x: 1 }));
    vi.stubGlobal('fetch', f);
    expect(await req('u', undefined, 3, 0)).toEqual({ x: 1 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('rejects after the last try fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(req('u', undefined, 3, 0)).rejects.toThrow('HTTP 503');
  });
  it('POSTs JSON when given a body', async () => {
    const f = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal('fetch', f);
    await req('u', { a: 1 });
    expect(f.mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{"a":1}' });
  });
});

describe('pooled', () => {
  it('keeps at most width calls in flight and preserves order', async () => {
    let live = 0, peak = 0;
    const out = await pooled([1, 2, 3, 4, 5, 6, 7], 3, async n => {
      live++; peak = Math.max(peak, live);
      await new Promise(r => setTimeout(r, 5 * (8 - n)));
      live--; return n * 10;
    });
    expect(peak).toBe(3);
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });
});

describe('fetchIndex', () => {
  it('maps metadata and flags active and grid-in items', async () => {
    const row = (id: string, ext: string) => ({ questionId: id, external_id: ext, primary_class_cd: 'H',
      primary_class_cd_desc: 'Algebra', skill_desc: 'Linear equations', difficulty: 'M' });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
      if (url === API.LOOKUP) return ok({ readingLiveItems: [], mathLiveItems: ['e2'] });
      const body = JSON.parse(init.body);
      return ok(body.test === 2 ? [row('00165291', 'e1'), row('zzzzzzzz', 'e2'), { questionId: 'n' }] : [{ ...row('r1', 'er1'), primary_class_cd: 'CAS' }]);
    }));
    const idx = await fetchIndex();
    expect(idx.rw.map(m => m.ext)).toEqual(['er1']);
    expect(idx.math).toEqual([
      { id: '00165291', ext: 'e1', dom: 'H', domName: 'Algebra', skill: 'Linear equations', diff: 'M', live: 0, type: 'spr' },
      { id: 'zzzzzzzz', ext: 'e2', dom: 'H', domName: 'Algebra', skill: 'Linear equations', diff: 'M', live: 1, type: 'mcq' },
    ]);
  });
});

describe('normalise', () => {
  it('produces a body with defaults', () => {
    expect(normalise({ stem: 's', answerOptions: [{ content: 'a' }], correct_answer: ['A'] }))
      .toEqual({ v: BODY_SCHEMA, type: 'mcq', sti: '', stem: 's', opts: ['a'], ans: ['A'], rat: '' });
  });
});
