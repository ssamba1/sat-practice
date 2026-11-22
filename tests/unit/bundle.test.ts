import { describe, it, expect } from 'vitest';
import { parseBundle } from '../../src/api/bundle';
import { BODY_SCHEMA } from '../../src/api/questions';

const q = (id: string, extra = {}) => ({ id, ext: 'x' + id, dom: 'H', domName: 'Algebra', skill: 'Linear', diff: 'E', type: 'mcq',
  sti: '', stem: '<math><mfenced><mi>a</mi></mfenced></math>', opts: ['1', '2', '3', '4'], ans: ['A'], rat: 'r', live: 1, ...extra });

describe('parseBundle', () => {
  it('reads the refresh_questions.py format into an index and bodies', () => {
    const text = 'window.QBANK=' + JSON.stringify({ rw: [], math: [q('1'), q('2', { ext: undefined, live: undefined })] }) + ';\n';
    const { index, bodies } = parseBundle(text);
    expect(index.math[0]).toEqual({ id: '1', ext: 'x1', dom: 'H', domName: 'Algebra', skill: 'Linear', diff: 'E', live: 1, type: 'mcq' });
    expect(index.math[1].ext).toBe('2');          // older bundles keyed by id only
    expect(index.math[1].live).toBe(0);
    expect(bodies[0][0]).toBe('x1');
    expect(bodies[0][1].v).toBe(BODY_SCHEMA);
    expect(bodies[0][1].stem).not.toContain('mfenced');
  });
  it('rejects text that is not a bundle', () => {
    expect(() => parseBundle('hello')).toThrow();
    expect(() => parseBundle('window.QBANK={"rw":[]};')).toThrow('not a questions bundle');
  });
});
