import type { Question } from '../api/questions';
import type { Session } from './machine';

const SCHEMA = 1;
const MAX_AGE = 7 * 24 * 3600 * 1000;   // a week-old session is not worth offering

/** Stores question ids, never content, and time remaining rather than a deadline,
 *  so the clock pauses while the tab is closed. */
export function snapshot(s: Session, now: number): string {
  const stages = s.stages.map(st => st.kind === 'module' ? { ...st, qs: st.qs ? st.qs.map(q => q.ext) : null } : st);
  return JSON.stringify({ ...s, v: SCHEMA, at: now, stages, on: null, clockAt: null });
}

export function peek(json: string | null): { at: number; label: string } | null {
  try {
    const r = JSON.parse(json || 'null');
    if (!r || r.v !== SCHEMA || r.view === 'results') return null;
    const label = r.mode === 'full' ? 'Full-length test' : r.stages.filter((x: any) => x.kind === 'module').map((x: any) => x.label).join(' + ');
    return { at: r.at, label };
  } catch { return null; }
}

export async function restore(json: string, hydrate: (exts: string[]) => Promise<Question[]>, now: number):
  Promise<{ session: Session; gapMs: number } | null> {
  let r: any;
  try { r = JSON.parse(json); } catch { return null; }
  if (!r || r.v !== SCHEMA || typeof r.at !== 'number' || now - r.at > MAX_AGE || r.view === 'results' || !Array.isArray(r.stages)) return null;
  const stages = [];
  for (const st of r.stages) {
    if (st.kind === 'module' && Array.isArray(st.qs)) {
      const qs = await hydrate(st.qs);
      if (qs.length !== st.qs.length || qs.some(q => !q)) return null;
      stages.push({ ...st, qs });
    } else stages.push(st);
  }
  const { v: _v, at, ...rest } = r;
  return { session: { ...rest, stages, on: null, clockAt: null }, gapMs: now - at };
}
