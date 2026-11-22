import type { QType } from '../api/questions';

export const LETTERS = ['A', 'B', 'C', 'D'];

export function numify(s: string): number {
  s = String(s).trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (/^-?\d+\/\d+$/.test(s)) { const [a, b] = s.split('/'); return +b ? +a / +b : NaN; }
  if (/^-?(\d+\.?\d*|\.\d+)%$/.test(s)) return parseFloat(s) / 100;
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
}

export function isCorrect(q: { type: QType; ans: string[] }, resp: number | string | null): boolean {
  if (resp == null || resp === '') return false;
  if (!Array.isArray(q.ans)) return false;   // un-hydrated: no key, scored wrong rather than throwing
  if (q.type === 'spr') {
    const clean = String(resp).trim().replace(/\s+/g, '');
    if (q.ans.some(a => String(a).trim().replace(/\s+/g, '') === clean)) return true;
    const v = numify(clean);
    if (Number.isNaN(v)) return false;
    // Bluebook: a repeating value counts when truncated or rounded to fill the field
    const dp = (clean.split('.')[1] || '').length;
    return q.ans.some(a => {
      const w = numify(String(a));
      if (Number.isNaN(w)) return false;
      if (Math.abs(w - v) < 1e-9) return true;
      if (dp < 3) return false;
      const f = 10 ** dp;
      return Math.abs(Math.trunc(w * f) / f - v) < 1e-9 || Math.abs(Math.round(w * f) / f - v) < 1e-9;
    });
  }
  return q.ans.includes(LETTERS[resp as number]);
}

/** Bluebook's grid-in field: digits, . / and a leading minus; 5 characters, 6 if negative. */
export function cleanGridIn(raw: string): string {
  const v = raw.replace(/[^0-9./-]/g, '').replace(/(?!^)-/g, '');
  return v.slice(0, v[0] === '-' ? 6 : 5);
}
