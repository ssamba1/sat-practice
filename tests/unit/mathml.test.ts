import { describe, it, expect } from 'vitest';
import { fixMathML } from '../../src/api/mathml';

const strip = (s: string) => s.replace(/\s+/g, '');

describe('fixMathML', () => {
  it('turns a single-child mfenced into explicit parentheses', () => {
    expect(strip(fixMathML('<math><mfenced><mi>x</mi></mfenced></math>')))
      .toBe('<math><mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow></math>');
  });
  it('honours open and close attributes', () => {
    expect(strip(fixMathML('<math><mfenced open="[" close="]"><mi>x</mi></mfenced></math>')))
      .toBe('<math><mrow><mo>[</mo><mi>x</mi><mo>]</mo></mrow></math>');
  });
  it('separates multiple children with commas', () => {
    expect(strip(fixMathML('<math><mfenced><mi>x</mi><mi>y</mi></mfenced></math>')))
      .toBe('<math><mrow><mo>(</mo><mi>x</mi><mo>,</mo><mi>y</mi><mo>)</mo></mrow></math>');
  });
  it('expands nested mfenced completely', () => {
    const out = fixMathML('<math><mfenced><mfenced><mi>x</mi></mfenced></mfenced></math>');
    expect(out).not.toContain('mfenced');
    expect((out.match(/<mo>\(<\/mo>/g) || []).length).toBe(2);
  });
  it('returns markup without mfenced unchanged', () => {
    const s = '<p>Plain <b>text</b></p>';
    expect(fixMathML(s)).toBe(s);
  });
});
