/**
 * SAT Weekend dates, the same for U.S. and international students.
 * Source: https://satsuite.collegeboard.org/sat/dates-deadlines (read 2026-11-25).
 * `register` is the regular registration deadline, `late` the last day of late registration
 * (extra fee); both end at 11:59 p.m. ET. `expected` marks dates College Board
 * lists as "anticipated" and has not confirmed; recheck that page when updating.
 */
export interface SatDate { date: string; register?: string; late?: string; expected: boolean }

export const SAT_DATES: SatDate[] = [
  { date: '2026-10-03', register: '2026-09-18', late: '2026-09-22', expected: false },
  { date: '2026-11-07', register: '2026-10-23', late: '2026-10-27', expected: false },
  { date: '2026-12-05', register: '2026-11-20', late: '2026-11-24', expected: false },
  { date: '2027-03-06', register: '2027-02-19', late: '2027-02-23', expected: false },
  { date: '2027-05-01', register: '2027-04-16', late: '2027-04-20', expected: false },
  { date: '2027-06-05', register: '2027-05-21', late: '2027-05-25', expected: false },
  { date: '2027-08-28', expected: true },
  { date: '2027-09-18', expected: true },
  { date: '2027-10-09', expected: true },
  { date: '2027-11-06', expected: true },
  { date: '2027-12-04', expected: true },
  { date: '2028-03-04', expected: true },
  { date: '2028-05-06', expected: true },
  { date: '2028-06-03', expected: true },
];
