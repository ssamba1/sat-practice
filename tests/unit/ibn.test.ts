import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchIndex, hydrate, normaliseIbn, sprKey, API } from '../../src/api/questions';
import { loadIndex } from '../../src/store/idb';
import { isCorrect } from '../../src/score/check';

// Older math questions have an `ibn` instead of an external_id; College Board serves
// them from saic.collegeboard.org/disclosed/<ibn>.json (checked 2026-11-26: 459 of 2,095).
const img = (alt: string) => `<span class="math-container"><img class="math-img" src="data:image/png;base64,AA==" alt="${alt}"></span>`;
const rat = (s: string) => `<p>${s} More explanation here.</p>`;

describe('IBN questions in the index', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps a row that has an ibn but no external_id, keyed by the ibn', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => ({ ok: true, json: async () =>
      url === API.LOOKUP ? { readingLiveItems: [], mathLiveItems: [] }
        : JSON.parse(init.body).test === 2
          ? [{ questionId: 'f224df07', external_id: null, ibn: '022222-DC', primary_class_cd: 'H', skill_desc: 's', difficulty: 'M' }]
          : [{ questionId: 'r', external_id: 'er', primary_class_cd: 'CAS', skill_desc: 'w', difficulty: 'E' }] })));
    const idx = await fetchIndex();
    expect(idx.math.map(m => [m.id, m.ext])).toEqual([['f224df07', '022222-DC']]);
  });
});

describe('reading an IBN record', () => {
  const mc = (extra: object) => ({ item_id: '1-DC', section: 'Math', prompt: '<p>Stem</p>', body: '<p>Table</p>',
    answer: { style: 'Multiple Choice', choices: { a: { body: '<p>2</p>' }, b: { body: '<p>4</p>' }, c: { body: '<p>5</p>' }, d: { body: '<p>6</p>' } },
      rationale: rat('Choice C is correct.'), ...extra } });
  it('maps stem, table, choices and key', () => {
    const b = normaliseIbn(mc({ correct_choice: 'c' }));
    expect(b).toMatchObject({ type: 'mcq', stem: '<p>Stem</p>', sti: '<p>Table</p>', ans: ['C'] });
    expect(b.opts).toEqual(['<p>2</p>', '<p>4</p>', '<p>5</p>', '<p>6</p>']);
  });
  it('takes the key from the explanation when correct_choice is missing', () => {
    expect(normaliseIbn(mc({})).ans).toEqual(['C']);
  });
  it('reads a grid-in answer from the explanation', () => {
    const b = normaliseIbn({ item_id: '2-DC', prompt: '<p>x</p>', answer: { style: 'SPR', rationale: rat('The correct answer is 4.44.') } });
    expect(b).toMatchObject({ type: 'spr', ans: ['4.44'], opts: [] });
  });
});

describe('grid-in keys written in words', () => {
  const key = (s: string) => sprKey(rat(s));
  it('handles whole numbers, decimals and thousands separators', () => {
    expect(key('The correct answer is 360.')).toEqual(['360']);
    expect(key('The correct answer is 0.')).toEqual(['0']);
    expect(key('The correct answer is 3,540.')).toEqual(['3540']);
    expect(key('The correct answer is 22.4.')).toEqual(['22.4']);
  });
  it('handles fractions drawn as images', () => {
    expect(key(`The correct answer is ${img('three halves')} .`)).toEqual(['3/2']);
    expect(key(`The correct answer is ${img('one half')} .`)).toEqual(['1/2']);
    expect(key(`The correct answer is ${img('7 over 6')} .`)).toEqual(['7/6']);
    expect(key(`The correct answer is ${img('one sixth')} .`)).toEqual(['1/6']);
  });
  it('accepts every listed answer', () => {
    expect(key('The correct answer is either 0 or 3.')).toEqual(['0', '3']);
    expect(key('The correct answer is either 7, 8, or 13.')).toEqual(['7', '8', '13']);
    expect(key(`The correct answer is either ${img('the fraction 10 over 3')} , ${img('the fraction 15 over 4')} , or ${img('the fraction 25 over 6')} .`))
      .toEqual(['10/3', '15/4', '25/6']);
  });
  it('scores a decimal entry for a fraction key, as Bluebook does', () => {
    expect(isCorrect({ type: 'spr', ans: key(`The correct answer is ${img('three halves')} .`) }, '1.5')).toBe(true);
    expect(isCorrect({ type: 'spr', ans: key(`The correct answer is ${img('the fraction 10 over 3')} .`) }, '3.333')).toBe(true);
  });
  it('returns no key rather than a wrong one when the wording is unfamiliar', () => {
    expect(key('The answer can be found by factoring.')).toEqual([]);
  });
});

describe('loading an IBN question', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('fetches it from the disclosed-items host', async () => {
    const f = vi.fn(async (url: string) => ({ ok: true, json: async () => [{ item_id: '9-DC', prompt: '<p>s</p>',
      answer: { style: 'SPR', rationale: rat('The correct answer is 8.') } }] }));
    vi.stubGlobal('fetch', f);
    const cache = { getMany: async () => ({}), putMany: async () => {} };
    const { qs } = await hydrate([{ id: 'q9', ext: '9-DC', dom: 'H', domName: 'Algebra', skill: 's', diff: 'M', live: 0, type: 'mcq' }], cache);
    expect(f.mock.calls[0][0]).toBe('https://saic.collegeboard.org/disclosed/9-DC.json');
    expect(qs[0]).toMatchObject({ type: 'spr', ans: ['8'] });
  });
});

describe('index cache from before IBN questions', () => {
  it('is fetched again instead of waiting out its week', async () => {
    const db = { get: async () => ({ ts: Date.now(), data: { rw: [], math: [] } }), put: async () => {} } as any;
    const fresh = { rw: [], math: [{ id: 'x' }] } as any;
    expect((await loadIndex(db, async () => fresh)).from).toBe('network');
  });
});
