import { describe, it, expect } from 'vitest';
import { backupJson, importBackup, importModuleDrill, mergeImported } from '../../src/store/backup';
import { defaultState } from '../../src/store/state';

const NOW = new Date(2026, 10, 22).getTime();

const mdFile = () => ({
  moduledrill: 1, at: 1,
  data: {
    'satsim.missed': JSON.stringify({ v: 1, m: { extA: [1, 2, 1000], extB: [0, 1, 2000] } }),
    'satsim.seen': JSON.stringify(['id1', 'id2']),
    'satsim.vocab': JSON.stringify({ v: 1, w: { catalyst: [2, 500] } }),
    'satsim.history': JSON.stringify([{ when: '11/20/2026, 3:00:00 PM', what: 'Math Module 1', correct: 15, total: 22, doms: { Algebra: [5, 7] } }]),
    'satsim.noActive': 'false',
    'satsim.tutor': 'true',
    'satsim.session': '{"ignored":true}',
  },
});

describe('own backups', () => {
  it('round-trips the state', () => {
    const s = defaultState(); s.seen = ['a']; s.settings.tutor = true;
    expect(importBackup(JSON.parse(backupJson(s, NOW)))).toEqual(s);
  });
  it('rejects a file from something else', () => {
    expect(importBackup({ app: 'other', state: {} })).toBeInstanceOf(Error);
    expect(importBackup('nope')).toBeInstanceOf(Error);
  });
});

describe('ModuleDrill import', () => {
  it('brings mistakes, seen, vocab, history and settings', () => {
    const r = importModuleDrill(mdFile(), NOW);
    if (r instanceof Error) throw r;
    expect(r.state.review!.extA).toEqual({ sec: 'math', stage: 0, due: NOW, okDays: [], misses: 2, lastMiss: 1000 });
    expect(r.state.review!.extB.sec).toBe('rw');
    expect(r.state.seen).toEqual(['id1', 'id2']);
    expect(r.state.vocab).toEqual({ catalyst: [2, 500] });
    expect(r.state.sessions![0]).toMatchObject({ legacy: true, label: 'Math Module 1', correct: 15, total: 22, doms: { Algebra: [5, 7] } });
    expect(r.state.settings).toEqual({ noActive: false, tutor: true });
    expect(r.report.join(' ')).toContain('2 mistakes');
  });
  it('skips a key whose value is not JSON and keeps the rest', () => {
    const f = mdFile(); f.data['satsim.missed'] = '{broken';
    const r = importModuleDrill(f, NOW);
    if (r instanceof Error) throw r;
    expect(r.state.review).toBeUndefined();
    expect(r.state.seen).toEqual(['id1', 'id2']);
  });
  it('rejects a file that is not a ModuleDrill backup', () => {
    expect(importModuleDrill({ data: {} }, NOW)).toBeInstanceOf(Error);
  });
  it('merges without replacing what is already there', () => {
    const cur = defaultState();
    cur.seen = ['id2', 'id9'];
    cur.review.extA = { sec: 'math', stage: 1, due: 5, okDays: ['2026-11-21'], misses: 1, lastMiss: 9999 };
    cur.vocab.zeal = [3, 1];
    const r = importModuleDrill(mdFile(), NOW);
    if (r instanceof Error) throw r;
    const m = mergeImported(cur, r.state);
    expect(m.seen.sort()).toEqual(['id1', 'id2', 'id9']);
    expect(m.review.extA.lastMiss).toBe(9999);     // the later miss wins
    expect(m.review.extB).toBeDefined();
    expect(m.vocab).toEqual({ zeal: [3, 1], catalyst: [2, 500] });
    expect(m.sessions).toHaveLength(1);
  });
});
