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

describe('official SAT dates', () => {
  const at = (iso: string) => new Date(iso + 'T12:00:00').getTime();
  it('lists only dates from today on, soonest first', async () => {
    const { upcomingSat } = await import('../../src/trainer/goal');
    const up = upcomingSat(at('2026-11-22'));
    expect(up[0]).toMatchObject({ date: '2026-12-05', register: '2026-11-20', expected: false });
    expect(up.map(d => d.date)).not.toContain('2026-11-07');
    expect(up.map(d => d.date)).toEqual([...up.map(d => d.date)].sort());
    expect(upcomingSat(at('2026-12-05'))[0].date).toBe('2026-12-05');
  });
  it('marks the 2027-28 dates as expected, with no deadline', async () => {
    const { upcomingSat } = await import('../../src/trainer/goal');
    const aug = upcomingSat(at('2027-07-01'))[0];
    expect(aug).toEqual({ date: '2027-08-28', expected: true });
  });
  it('lists every official date as a real Saturday', async () => {
    const { SAT_DATES } = await import('../../src/data/satdates');
    expect(SAT_DATES).toHaveLength(14);
    for (const d of SAT_DATES) expect(new Date(d.date + 'T12:00:00').getDay()).toBe(6);
  });
});
