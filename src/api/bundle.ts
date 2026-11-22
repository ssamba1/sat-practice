import { BODY_SCHEMA, type Body, type Index, type Section } from './questions';
import { fixMathML } from './mathml';

/** Read a questions.js made by scripts/refresh_questions.py (`window.QBANK={...};`).
 *  Bodies are stamped with the current schema so hydrate() trusts them offline. */
export function parseBundle(text: string): { index: Index; bodies: [string, Body][] } {
  const start = text.indexOf('=') + 1;
  const data = JSON.parse(text.slice(start, text.lastIndexOf('}') + 1));
  if (!Array.isArray(data?.rw) || !Array.isArray(data?.math)) throw new Error('not a questions bundle');
  const index = { rw: [], math: [] } as Index, bodies: [string, Body][] = [];
  for (const sec of ['rw', 'math'] as Section[]) {
    index[sec] = data[sec].map((q: any) => {
      const ext = q.ext || q.id;
      bodies.push([ext, { v: BODY_SCHEMA, type: q.type, sti: fixMathML(q.sti || ''), stem: fixMathML(q.stem || ''),
        opts: (q.opts || []).map(fixMathML), ans: q.ans || [], rat: fixMathML(q.rat || '') }]);
      return { id: q.id, ext, dom: q.dom, domName: q.domName, skill: q.skill, diff: q.diff, live: q.live ? 1 : 0, type: q.type };
    });
  }
  return { index, bodies };
}
