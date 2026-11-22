import type { Page } from '@playwright/test';

// Synthetic questions only: no College Board content.
const RW = ['CAS', 'INI', 'SEC', 'EOI'], MATH = ['H', 'P', 'Q', 'S'], DIFF = ['E', 'M', 'H'];
// real grid-in ids from src/data/gridins.ts, so the seeded type guess lines up
export const GRID_IDS = ['00165291', '002dba45', '00723d16', '014c47ab', '022e9894', '02c67921', '03ff48d2', '040f2a84'];

function rows(test: number) {
  const out: any[] = [];
  for (let i = 0; i < 160; i++) {
    const math = test === 2, dom = (math ? MATH : RW)[i % 4];
    const id = math && i % 4 === 0 && i / 4 < GRID_IDS.length ? GRID_IDS[i / 4] : `${math ? 'm' : 'r'}${i}`;
    out.push({ questionId: id, external_id: `x-${id}`, primary_class_cd: dom, primary_class_cd_desc: dom,
      skill_desc: `Skill ${i % 3}`, difficulty: DIFF[i % 3] });
  }
  return out;
}

export async function mockBank(page: Page) {
  await page.route('https://qbank-api.collegeboard.org/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/lookup')) return route.fulfill({ json: { readingLiveItems: ['x-r1'], mathLiveItems: [] } });
    const body = route.request().postDataJSON();
    if (url.endsWith('/get-questions')) return route.fulfill({ json: rows(body.test) });
    const ext: string = body.external_id, id = ext.slice(2), grid = GRID_IDS.includes(id);
    return route.fulfill({ json: grid
      ? { type: 'spr', stem: `<p>Grid-in ${id}: what is one half?</p>`, correct_answer: ['1/2', '.5'], rationale: '<p>One half.</p>' }
      : { type: 'mcq', stimulus: id.startsWith('r') ? `<p>Passage for ${id}. Some text to read.</p>` : '', stem: `<p>Question ${id}</p>`,
          answerOptions: ['A', 'B', 'C', 'D'].map(l => ({ content: `<p>Option ${l}</p>` })), correct_answer: ['B'],
          rationale: `<p>Because B, for ${id}.</p>` } });
  });
  await page.route('https://www.desmos.com/**', route => route.fulfill({ body: '<html><body>calculator</body></html>', contentType: 'text/html' }));
}
