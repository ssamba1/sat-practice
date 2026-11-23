import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Question } from '../../src/api/questions';
import { fetchIndex, API } from '../../src/api/questions';
import { parseBundle } from '../../src/api/bundle';
import { sanitizeHtml } from '../../src/api/sanitize';
import { startSession, setStageQs, modulePlan, fullTestPlan, drillPlan, tick } from '../../src/session/machine';
import { snapshot, peek } from '../../src/session/resume';
import { backupJson, importBackup, importModuleDrill, mergeImported } from '../../src/store/backup';
import { defaultState } from '../../src/store/state';

const MIN = 60000;
const q = (i: number, dom = 'H'): Question => ({ id: 'id' + i, ext: 'ext' + i, dom, domName: dom, skill: 's', diff: 'M', live: 0, type: 'mcq',
  v: 3, sti: '', stem: 's', opts: ['a', 'b', 'c', 'd'], ans: ['B'], rat: '' });
const many = (n: number, dom = 'H') => Array.from({ length: n }, (_, i) => q(i, dom));

describe('time running out on a timed module', () => {
  it('submits a single module straight to results', () => {
    let s = setStageQs(startSession('module', false, modulePlan('math'), 0), many(22));
    s = tick(s, 0); s = tick(s, 35 * MIN + 1);
    expect(s.view).toBe('results');
  });
  it('moves a full test on to Module 2, so no late answers count', () => {
    let s = setStageQs(startSession('full', false, fullTestPlan(), 0), many(27, 'CAS'));
    s = tick(s, 0); s = tick(s, 32 * MIN + 1);
    expect(s.stage).toBe(1);
    expect(s.view).toBe('q');
  });
});

describe('time away from an open tab', () => {
  it('does not charge a long gap (sleep, background tab) to the question', () => {
    let s = startSession('today', false, drillPlan(many(2), 20, 'Today', true), 0);
    s = tick(s, 0); s = tick(s, 5000); s = tick(s, 5000 + 8 * 3600e3);
    expect(s.time[0][0]).toBe(5000);
  });
});

describe('restoring a backup', () => {
  it('refuses a backup from another version instead of wiping everything', () => {
    const json = JSON.parse(backupJson(defaultState(), 1));
    json.state.v = 2;
    expect(importBackup(json)).toBeInstanceOf(Error);
  });
});

describe('ModuleDrill import', () => {
  const file = () => ({ moduledrill: 1, at: 1, data: {
    'satsim.history': JSON.stringify([{ when: '2026-11-01T10:00:00Z', what: 'Math', correct: 5, total: 10 }]),
    'satsim.tutor': 'true', 'satsim.noActive': 'true' } });
  it('keeps the current settings and does not duplicate sessions on a second import', () => {
    let cur = defaultState(); cur.settings.tutor = false; cur.settings.noActive = false;
    for (let i = 0; i < 2; i++) { const r = importModuleDrill(file(), 5); if (r instanceof Error) throw r; cur = mergeImported(cur, r.state); }
    expect(cur.sessions).toHaveLength(1);
    expect(cur.settings.tutor).toBe(false);
    expect(cur.settings.noActive).toBe(false);
  });
});

describe('resume card', () => {
  it('is not offered for a session too old to restore', () => {
    const s = setStageQs(startSession('module', false, modulePlan('math'), 0), many(3));
    const json = snapshot(s, 0);
    expect(peek(json, 1000)).not.toBeNull();
    expect(peek(json, 8 * 24 * 3600e3)).toBeNull();
  });
});

describe('unexpected API data', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ok = (x: unknown) => ({ ok: true, json: async () => x });
  it('gives a row with no skill an empty skill and drops unknown difficulty codes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
      if (url === API.LOOKUP) return ok({ readingLiveItems: [], mathLiveItems: [] });
      return ok(JSON.parse(init.body).test === 2 ? [
        { questionId: 'a', external_id: 'e1', primary_class_cd: 'H', difficulty: 'M' },
        { questionId: 'b', external_id: 'e2', primary_class_cd: 'H', skill_desc: 'x', difficulty: 'X' },
      ] : []);
    }));
    const idx = await fetchIndex();
    expect(idx.math.map(m => [m.ext, m.skill])).toEqual([['e1', '']]);
  });
  it('does the same for a bundle file', () => {
    const text = 'window.QBANK=' + JSON.stringify({ rw: [], math: [{ id: 'a', dom: 'H', diff: 'E', type: 'mcq' }, { id: 'b', dom: 'H', skill: 'x', diff: 'Q', type: 'mcq' }] }) + ';';
    expect(parseBundle(text).index.math.map(m => [m.id, m.skill])).toEqual([['a', '']]);
  });
});

describe('sanitizer', () => {
  it('drops SVG animation elements that can rewrite links', () => {
    const out = sanitizeHtml('<svg><a><animate attributeName="href" values="javascript:alert(1)"/><set attributeName="href" to="javascript:x"/><text>t</text></a></svg>');
    expect(out).not.toMatch(/animate|<set/i);
    expect(out).toContain('t');
  });
});
