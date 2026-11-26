import { SAT_DATES, type SatDate } from '../data/satdates';

/** Local Monday 00:00 of the week containing `now`. */
export function weekStart(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.getTime();
}

/** Whole days from today (local) to a YYYY-MM-DD date; negative once it has passed. */
export function daysUntil(date: string, now: number) {
  const [y, m, d] = date.split('-').map(Number);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 864e5);
}

/** Official SAT dates from today (local) on, soonest first. */
export const upcomingSat = (now: number) => SAT_DATES.filter(d => daysUntil(d.date, now) >= 0);

export type Registration = { kind: 'expected' | 'closed' } | { kind: 'regular' | 'late'; until: string };

const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });

/** The instant a College Board deadline ends: 11:59:59 p.m. New York time on that date. */
export function etDeadline(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const asUtc = Date.UTC(y, m - 1, d, 23, 59, 59);
  const p = Object.fromEntries(ET.formatToParts(asUtc).map(x => [x.type, Number(x.value)]));
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc + (asUtc - wall);   // shift by New York's offset that day (EST or EDT)
}

/** Where registration stands for an official date, judged by College Board's ET deadlines. */
export function registration(d: SatDate, now: number): Registration {
  if (d.expected || !d.register) return { kind: 'expected' };
  if (now <= etDeadline(d.register)) return { kind: 'regular', until: d.register };
  if (d.late && now <= etDeadline(d.late)) return { kind: 'late', until: d.late };
  return { kind: 'closed' };
}
