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
