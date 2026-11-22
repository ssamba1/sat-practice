import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Meta, Question } from '../../src/api/questions';
import { normalise } from '../../src/api/questions';
import { parseBundle } from '../../src/api/bundle';
import { buildModule, seeded } from '../../src/bank/build';
import { MIX } from '../../src/bank/spec';
import { defaultState, saveState, STATE_KEY } from '../../src/store/state';
import { startSession, drillPlan, submitModule } from '../../src/session/machine';
import * as store from '../../src/ui/store';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Important 2: no question twice in one test', () => {
  it('buildModule never picks an excluded id, even when everything is seen', () => {
    const rw: Meta[] = [];
    for (let i = 0; i < 60; i++) rw.push({ id: 'r' + i, ext: 'e' + i, dom: ['CAS', 'INI', 'SEC', 'EOI'][i % 4], domName: '', skill: 's', diff: 'M', live: 0, type: 'mcq' });
    const all = new Set(rw.map(q => q.id));
    const first = buildModule({ rw, math: [] }, 'rw', MIX.m1, { noActive: true, seen: all, rng: seeded(1) }).qs;
    const second = buildModule({ rw, math: [] }, 'rw', MIX.m2easy, { noActive: true, seen: all, rng: seeded(2), exclude: new Set(first.map(q => q.id)) }).qs;
    expect(second.filter(q => first.some(f => f.id === q.id))).toEqual([]);
  });
});

describe('Important 3: question HTML is sanitized', () => {
  const evil = '<p onclick="steal()">Hi<img src="x" onerror="steal()"><script>steal()</script><a href="javascript:steal()">l</a><iframe src="https://e.vil"></iframe></p><math><mi>x</mi></math>';
  const clean = (h: string) => {
    expect(h).not.toMatch(/onerror|onclick|<script|javascript:|<iframe/i);
    expect(h).toContain('<math>');
    expect(h).toContain('Hi');
  };
  it('in bodies from the API', () => {
    const b = normalise({ stimulus: evil, stem: evil, answerOptions: [{ content: evil }], rationale: evil });
    [b.sti, b.stem, b.opts[0], b.rat].forEach(clean);
  });
  it('in bundles', () => {
    const q = { id: '1', ext: 'x', dom: 'H', domName: 'A', skill: 's', diff: 'E', type: 'mcq', sti: evil, stem: evil, opts: [evil], ans: ['A'], rat: evil };
    const { bodies } = parseBundle('window.QBANK=' + JSON.stringify({ rw: [], math: [q] }) + ';');
    clean(bodies[0][1].stem);
  });
});

const q = (i: number): Question => ({ id: 'id' + i, ext: 'ext' + i, dom: 'H', domName: 'Algebra', skill: 's', diff: 'M', live: 0, type: 'mcq',
  v: 3, sti: '', stem: 's', opts: ['a', 'b', 'c', 'd'], ans: ['B'], rat: '' });

describe('Important 4: storage full at the end keeps the resumable copy', () => {
  it('leaves the session snapshot when results cannot be saved', () => {
    store.session.value = startSession('custom', false, drillPlan([q(1)], null), 0);
    store.act(s => s);   // no-op guard
    store.act((s, t) => ({ ...s, resp: [[1]] }));
    expect(localStorage.getItem('sat-remake.session')).not.toBeNull();
    const real = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => { if (k === STATE_KEY) throw new Error('QuotaExceededError'); real(k, v); });
    store.act(submitModule);
    expect(store.screen.value).toBe('results');
    expect(localStorage.getItem('sat-remake.session')).not.toBeNull();
  });
});

describe('Important 5: a second tab does not overwrite history', () => {
  it('update merges onto what another tab saved', () => {
    store.storageWarn.value = false;   // the previous test left a failed save behind
    store.state.value = defaultState();
    const other = defaultState();
    other.sessions = [{ id: 'A', at: 1, label: 'tab A', correct: 1, total: 1, doms: {} }];
    saveState(other);                       // tab A finished a test
    store.update(s => ({ ...s, sessions: [{ id: 'B', at: 2, label: 'tab B', correct: 0, total: 1, doms: {} }, ...s.sessions] }));
    expect(store.state.value.sessions.map(r => r.id)).toEqual(['B', 'A']);
  });
});
