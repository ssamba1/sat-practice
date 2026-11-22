import { DOMNAME } from '../bank/spec';
import { LETTERS } from '../score/check';
import { summarise, type Tally } from '../stats/summary';
import type { Answer } from '../store/state';
import type { Question } from '../api/questions';
import { result, screen, startRetry, state } from './store';

const pct = (ok: number, n: number) => n ? Math.round(100 * ok / n) : 0;
const secs = (ms: number) => ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round(ms % 60000 / 1000)}s` : `${Math.round(ms / 1000)}s`;
const DIFF: Record<string, string> = { E: 'Easy', M: 'Medium', H: 'Hard' };
const showResp = (q: Question, r: Answer['resp']) => r == null || r === '' ? 'no answer' : q.type === 'mcq' ? LETTERS[r as number] : String(r);

function Table({ title, rows }: { title: string; rows: [string, Tally][] }) {
  return (
    <div class="tablewrap"><table class="brk">
      <thead><tr><th>{title}</th><th>Correct</th><th>Accuracy</th><th>Avg time</th></tr></thead>
      <tbody>{rows.map(([label, t]) => (
        <tr><td>{label}</td><td>{t.ok} / {t.n}</td>
          <td><span class="meter" aria-hidden="true"><i style={{ width: pct(t.ok, t.n) + '%' }} /></span> {pct(t.ok, t.n)}%</td>
          <td>{secs(t.ms / t.n)}</td></tr>))}
      </tbody></table></div>);
}

export function Results() {
  const r = result.value;
  if (!r) return null;
  const s = summarise(r.answers, r.budgetMs);
  const byExt = new Map(r.qs.map(q => [q.ext, q]));
  const missed = r.answers.filter(a => !a.ok);
  const tutor = state.value.settings.tutor;
  const done = () => { result.value = null; screen.value = 'menu'; };

  return (
    <div class="screen"><div class="wrap">
      <h1>Results</h1>
      <p class="sub">{r.record.label}</p>
      <div class="big">
        <div class="stat"><b>{s.correct} / {s.total}</b><span>correct</span></div>
        <div class="stat"><b>{pct(s.correct, s.total)}%</b><span>accuracy</span></div>
        <div class="stat"><b>{secs(s.avgMs)}</b><span>avg per question</span></div>
      </div>
      <p class="hint">There is no 200 to 800 score here on purpose: this question bank is not equated like a real test form,
        so any scaled number would be made up. The tables below are the honest signal.</p>

      <div class="note">
        <b>Pacing.</b>{' '}
        {r.budgetMs != null && <>Your time limit works out to {secs(r.budgetMs)} per question. </>}
        {missed.length && s.correct ? <>Right answers took {secs(s.okAvgMs)} on average, wrong ones {secs(s.wrongAvgMs)}. </> : null}
        {s.slow.length ? <>{s.slow.length} question{s.slow.length > 1 ? 's' : ''} took more than twice the budget.</> : r.budgetMs != null ? 'Nothing took more than twice the budget.' : ''}
      </div>
      {(r.added || r.cleared) ? <p class="hint">Mistakes list: {r.added} added, {r.cleared} cleared after a second correct day.</p> : null}

      <div class="btnrow">
        {missed.length > 0 && <button class="navbtn" onClick={() => startRetry(missed.map(a => a.ext), tutor)}>Drill these {missed.length} again</button>}
        <button class="navbtn ghost" onClick={done}>Back to menu</button>
      </div>

      <h2>By domain</h2>
      <Table title="Domain" rows={Object.entries(s.byDomain).map(([k, t]) => [DOMNAME[k] ?? k, t])} />
      <h2>By skill</h2>
      <Table title="Skill" rows={Object.values(s.bySkill).sort((a, b) => a.ok / a.n - b.ok / b.n).map(t => [t.label, t])} />
      <h2>By difficulty</h2>
      <Table title="Difficulty" rows={(['E', 'M', 'H'] as const).filter(d => s.byDiff[d]).map(d => [DIFF[d], s.byDiff[d]])} />

      <h2>{missed.length ? `Missed questions (${missed.length})` : 'No missed questions'}</h2>
      {missed.map(a => <Review a={a} q={byExt.get(a.ext)!} slow={s.slow.includes(a.ext)} />)}
      <details><summary>Every question in this session</summary>
        {r.answers.map(a => <Review a={a} q={byExt.get(a.ext)!} slow={s.slow.includes(a.ext)} />)}
      </details>
    </div></div>);
}

function Review({ a, q, slow }: { a: Answer; q: Question; slow: boolean }) {
  if (!q) return null;
  return (
    <div class={'revq' + (a.ok ? '' : ' bad')}>
      <div class="tag"><b>{a.ok ? 'Correct' : 'Missed'}</b><span>{DOMNAME[a.dom]}</span><span>{a.skill}</span><span>{DIFF[a.diff]}</span>
        <span>{secs(a.ms)}{slow ? ' (over twice the budget)' : ''}</span>
        <span>You: {showResp(q, a.resp)}. Answer: {q.ans.join(' or ')}</span></div>
      {q.sti && <div class="stim" dangerouslySetInnerHTML={{ __html: q.sti }} />}
      <div class="stem" dangerouslySetInnerHTML={{ __html: q.stem }} />
      {q.type === 'mcq' && <ol type="A" style="margin:0 0 6px">{q.opts.map(o => <li dangerouslySetInnerHTML={{ __html: o }} />)}</ol>}
      <details><summary>Explanation</summary><div class="rat" dangerouslySetInnerHTML={{ __html: q.rat }} /></details>
    </div>);
}
