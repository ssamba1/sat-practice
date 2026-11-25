import { DOMNAME } from '../bank/spec';
import { LETTERS } from '../score/check';
import { summarise, type Tally } from '../stats/summary';
import type { Answer } from '../store/state';
import type { Question } from '../api/questions';
import { result, screen, startRetry, state, tagAnswer } from './store';
import { TAGS, TAG_LABEL, tagSplit } from '../trainer/tags';
import { budgetMs } from '../trainer/mastery';

const pct = (ok: number, n: number) => n ? Math.round(100 * ok / n) : 0;
export const secs = (ms: number) => { const t = Math.round(ms / 1000); return t >= 60 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${t}s`; };
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
  // a full test mixes sections with different budgets, so each question is judged by its own
  const full = r.mode === 'full';
  const s = summarise(r.answers, full ? a => budgetMs(a.sec) : r.budgetMs);
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
        {full ? <>Your time limit works out to {secs(budgetMs('rw'))} per Reading and Writing question and {secs(budgetMs('math'))} per Math question. </>
          : r.budgetMs != null && <>Your time limit works out to {secs(r.budgetMs)} per question. </>}
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
      {missed.length > 0 && <p class="hint">Tag why you missed each one. Careless slips and concept gaps need different fixes, and the skill map keeps the count.</p>}
      <WhySplit answers={r.answers} />
      {missed.map(a => <Review a={a} q={byExt.get(a.ext)!} slow={s.slow.includes(a.ext)} tags />)}
      <details><summary>Every question in this session</summary>
        {r.answers.map(a => <Review a={a} q={byExt.get(a.ext)!} slow={s.slow.includes(a.ext)} />)}
      </details>
    </div></div>);
}

function WhySplit({ answers }: { answers: Answer[] }) {
  const split = tagSplit(answers), total = Object.values(split).reduce((p, c) => p + c, 0);
  if (!total) return null;
  return <p class="note" style="margin:10px 0"><b>Why you missed:</b> {TAGS.filter(t => split[t]).map(t => `${TAG_LABEL[t]} ${split[t]}`).join(', ')}.</p>;
}

function Review({ a, q, slow, tags }: { a: Answer; q: Question; slow: boolean; tags?: boolean }) {
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
      {tags && !a.ok && <div class="tags" role="group" aria-label="Why did you miss this?">
        {TAGS.map(t => <button type="button" class="chip" aria-pressed={a.tag === t}
          onClick={() => tagAnswer(a.at, a.ext, a.tag === t ? null : t)}>{TAG_LABEL[t]}</button>)}
      </div>}
    </div>);
}
