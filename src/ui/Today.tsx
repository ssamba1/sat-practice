import { dueItems } from '../review/schedule';
import { skillStats, band } from '../trainer/mastery';
import { todayCount } from '../trainer/today';
import { weekStart, daysUntil } from '../trainer/goal';
import { state, index, update, startToday, screen } from './store';

const MINS = [10, 20, 40];

export function TodayCard() {
  const st = state.value, now = Date.now();
  const due = dueItems(st.review, now).length;
  const stats = skillStats(st.answers, index.value!, st.settings.noActive, now);
  const weak = stats.filter(s => s.available && (band(s.mastery) === 'weak' || band(s.mastery) === 'shaky'))
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0)).slice(0, 3);
  const tried = stats.filter(s => s.mastery != null).length;
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
  return (
    <div class="row" style="margin-top:12px">
      <label>Test date
        <input type="date" value={date ?? ''} onChange={e => {
          const v = (e.target as HTMLInputElement).value;
          update(s => ({ ...s, settings: { ...s.settings, goal: v ? { testDate: v } : undefined } }));
        }} /></label>
      {left != null && <span>{left > 1 ? `${left} days to go` : left === 1 ? 'Tomorrow' : left === 0 ? 'Today. Good luck.' : 'That date has passed'}</span>}
      <span class="hint" style="margin:0">This week: {week.length} Today session{week.length === 1 ? '' : 's'}, {mins} min.</span>
    </div>
  );
}
