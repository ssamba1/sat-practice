import { dueItems } from '../review/schedule';
import { skillStats, band } from '../trainer/mastery';
import { todayCount, buildToday, splitText } from '../trainer/today';
import { seeded } from '../bank/build';
import { weekStart, daysUntil, upcomingSat, registration, type Registration } from '../trainer/goal';
import { state, index, update, startToday, screen } from './store';

const MINS = [10, 20, 40];

export function TodayCard() {
  const st = state.value, now = Date.now();
  const due = dueItems(st.review, now).length;
  const stats = skillStats(st.answers, index.value!, st.settings.noActive, now);
  const weak = stats.filter(s => s.available && (band(s.mastery) === 'weak' || band(s.mastery) === 'shaky'))
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0)).slice(0, 3);
  const tried = stats.filter(s => s.mastery != null).length;
  const plan = buildToday(index.value!, st, 20, now, seeded(1));   // the split barely depends on the seed
  return (
    <section class="today" aria-labelledby="today-h">
      <h2 id="today-h" style="margin-top:0">Today</h2>
      <p class="sub" style="margin-bottom:12px">
        {tried === 0 ? 'A mixed session across skills, so the app can learn where you are.'
          : <>Built around {due ? `${due} mistake${due > 1 ? 's' : ''} due for review and ` : ''}your weakest skills
            {weak.length ? <>: {weak.map(w => w.label).join(', ')}</> : null}.</>}
      </p>
      <div class="btnrow">
        {MINS.map(m => <button class="navbtn" onClick={() => startToday(m)}>{m} min<span class="sr-only"> session</span></button>)}
        <span class="hint" style="margin:0">{MINS.map(m => `${m} min = ${todayCount(m)} questions`).join(', ')}. The clock shows but never cuts you off.</span>
      </div>
      {plan.metas.length > 0 && <p class="hint" style="margin:8px 0 0">A 20 min session right now: {splitText(plan.parts, plan.metas.length)}.</p>}
      <label class="row" style="margin-top:12px">
        <input type="checkbox" checked={st.settings.todayTutor}
          onChange={e => update(s => ({ ...s, settings: { ...s.settings, todayTutor: (e.target as HTMLInputElement).checked } }))} />
        Check each answer as I go
      </label>
      <Goal />
      <p style="margin:12px 0 0"><button class="linkbtn" style="padding:0;font-size:14px" onClick={() => { screen.value = 'skills'; }}>Open your skill map</button></p>
    </section>
  );
}

function Goal() {
  const st = state.value, now = Date.now(), date = st.settings.goal?.testDate;
  const wk = weekStart(now);
  const week = st.sessions.filter(s => s.mode === 'today' && s.at >= wk);
  const mins = Math.round(week.reduce((p, s) => p + (s.ms ?? 0), 0) / 60000);
  const left = date ? daysUntil(date, now) : null;
  const upcoming = upcomingSat(now), official = upcoming.find(d => d.date === date);
  const setDate = (v: string) => update(s => ({ ...s, settings: { ...s.settings, goal: v ? { testDate: v } : undefined } }));
  return (
    <div class="row" style="margin-top:12px">
      <label>Official SAT date
        <select value={official ? date : ''} onChange={e => setDate((e.target as HTMLSelectElement).value)}>
          <option value="">Pick one</option>
          {upcoming.map(d => <option key={d.date} value={d.date}>{fmt(d.date)}{d.expected ? ' (expected)' : ''}</option>)}
        </select></label>
      <label>Test date
        <input type="date" value={date ?? ''} onChange={e => setDate((e.target as HTMLInputElement).value)} /></label>
      {left != null && <span>{left > 1 ? `${left} days to go` : left === 1 ? 'Tomorrow' : left === 0 ? 'Today. Good luck.' : 'That date has passed'}</span>}
      {official && <span class="hint" style="margin:0">{regText(registration(official, now))}</span>}
      <span class="hint" style="margin:0">This week: {week.length} Today session{week.length === 1 ? '' : 's'}, {mins} min.</span>
    </div>
  );
}

const regText = (r: Registration) =>
  r.kind === 'expected' ? 'College Board has not confirmed this date yet.'
    : r.kind === 'regular' ? `Register by ${fmt(r.until)}.`
    : r.kind === 'late' ? `Regular registration has closed. Late registration (extra fee) runs until ${fmt(r.until)}.`
    : 'Registration for this date has closed.';

const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
