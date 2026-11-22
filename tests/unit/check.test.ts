import { describe, it, expect } from 'vitest';
import { isCorrect, cleanGridIn, numify } from '../../src/score/check';

const spr = (...ans: string[]) => ({ type: 'spr' as const, ans });
const mcq = (...ans: string[]) => ({ type: 'mcq' as const, ans });

describe('isCorrect', () => {
  it('accepts an equivalent fraction or decimal', () => {
    expect(isCorrect(spr('0.75'), '3/4')).toBe(true);
    expect(isCorrect(spr('-1/2'), '-.5')).toBe(true);
  });
  it('accepts a repeating value truncated or rounded to fill the field', () => {
    expect(isCorrect(spr('2/3'), '0.666')).toBe(true);
    expect(isCorrect(spr('2/3'), '0.667')).toBe(true);
    expect(isCorrect(spr('2/3'), '.6666')).toBe(true);
  });
  it('rejects too few digits and bad input', () => {
    expect(isCorrect(spr('2/3'), '0.67')).toBe(false);
    expect(isCorrect(spr('2/3'), '1/0')).toBe(false);
    expect(isCorrect(spr('2/3'), '')).toBe(false);
    expect(isCorrect(spr('2/3'), null)).toBe(false);
  });
  it('checks multiple choice by letter', () => {
    expect(isCorrect(mcq('B'), 1)).toBe(true);
    expect(isCorrect(mcq('B'), 2)).toBe(false);
    expect(isCorrect({ type: 'mcq', ans: undefined as any }, 1)).toBe(false);
  });
  it('numify parses fractions and percents', () => {
    expect(numify('3/4')).toBe(0.75);
    expect(Number.isNaN(numify('abc'))).toBe(true);
  });
});

describe('cleanGridIn', () => {
  it('keeps only what Bluebook accepts', () => {
    expect(cleanGridIn('3 1/2')).toBe('31/2');
    expect(cleanGridIn('50%')).toBe('50');
    expect(cleanGridIn('1-2')).toBe('12');
    expect(cleanGridIn('-123456')).toBe('-12345');
    expect(cleanGridIn('1234567')).toBe('12345');
    expect(cleanGridIn('$1,000')).toBe('1000');
  });
});
