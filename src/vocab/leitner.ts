import { VOCAB } from '../data/vocab';
import { shuffle, type Rng } from '../bank/build';

export const BOX_MAX = 3;   // three correct in a row and a word counts as known
export type VocabState = Record<string, [number, number]>;   // word -> [box, lastSeenAt]
export interface VocabItem { gi: number; wi: number; word: string; dir: 'w2d' | 'd2w' }

/** A third new words, the rest review weighted to the weakest and least recent:
 *  taking every new word first would be a shuffled deck, not spaced repetition. */
export function buildVocab(st: VocabState, n = 12, rng: Rng = Math.random): VocabItem[] {
  type C = { gi: number; wi: number; word: string; box: number; last: number };
  const fresh: C[] = [], seen: C[] = [];
  VOCAB.groups.forEach((g, gi) => g.w.forEach((word, wi) => {
    const r = st[word];
    (r ? seen : fresh).push({ gi, wi, word, box: r ? r[0] : -1, last: r ? r[1] : 0 });
  }));
  seen.sort((a, b) => a.box - b.box || a.last - b.last);
  shuffle(fresh, rng);
  const wantNew = Math.min(fresh.length, Math.max(1, Math.round(n / 3)));
  const picked: C[] = [], usedGroup = new Set<number>(), usedWord = new Set<string>();
  const take = (list: C[], cap: number) => {
    for (const c of list) {
      if (picked.length >= cap) return;
      // one word per group per session; some words sit in two groups
      if (usedGroup.has(c.gi) || usedWord.has(c.word)) continue;
      usedGroup.add(c.gi); usedWord.add(c.word); picked.push(c);
    }
  };
  take(seen, n - wantNew);
  take(fresh, n);
  take(seen, n);   // top up if groups collided
  return shuffle(picked, rng).map(c => ({ gi: c.gi, wi: c.wi, word: c.word, dir: rng() < 0.5 ? 'w2d' : 'd2w' }));
}

export function recordVocab(st: VocabState, word: string, ok: boolean, now: number): VocabState {
  const box = st[word]?.[0] ?? 0;
  return { ...st, [word]: [ok ? Math.min(BOX_MAX, box + 1) : 0, now] };
}

export function vocabProgress(st: VocabState) {
  const words = new Set(VOCAB.groups.flatMap(g => g.w));
  let seen = 0, known = 0;
  for (const w of words) { const b = st[w]; if (!b) continue; seen++; if (b[0] >= BOX_MAX) known++; }
  return { total: words.size, seen, known };
}
