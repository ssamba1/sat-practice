import { describe, it, expect } from 'vitest';
import { weekStart, daysUntil } from '../../src/trainer/goal';

describe('goal dates', () => {
  it('week starts on Monday at local midnight', () => {
    const sun = new Date(2026, 10, 22, 15).getTime();     // Sunday 22 Nov 2026
    expect(new Date(weekStart(sun))).toEqual(new Date(2026, 10, 16));
    const mon = new Date(2026, 10, 23, 0, 5).getTime();
    expect(new Date(weekStart(mon))).toEqual(new Date(2026, 10, 23));
  });
  it('counts whole days to the test date', () => {
    const now = new Date(2026, 10, 22, 23, 30).getTime();
    expect(daysUntil('2026-11-23', now)).toBe(1);
    expect(daysUntil('2026-11-22', now)).toBe(0);
    expect(daysUntil('2026-12-05', now)).toBe(13);
    expect(daysUntil('2026-11-01', now)).toBeLessThan(0);
  });
});
