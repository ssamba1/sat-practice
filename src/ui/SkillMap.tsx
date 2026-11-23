import { DOMNAME, SPEC } from '../bank/spec';
import type { Section } from '../api/questions';
import { skillStats, band, FORMULA, MIN_ANSWERS, type SkillStat } from '../trainer/mastery';
import { rightButSlow, slowMisses } from '../trainer/pacing';
import { TAGS, TAG_LABEL, type Tag } from '../trainer/tags';
import { state, index, screen, startCustom } from './store';

const secs = (ms: number) => `${Math.round(ms / 1000)}s`;
const BAND_LABEL = { unknown: 'Not enough data', weak: 'Weak', shaky: 'Shaky', solid: 'Solid', strong: 'Strong' };

export function SkillMap() {
  const st = state.value, now = Date.now();
  const stats = skillStats(st.answers, index.value!, st.settings.noActive, now);
  const slow = rightButSlow(stats), misses = slowMisses(st.answers, now);
  const back = () => { screen.value = 'menu'; };

  return (
    <div class="screen"><div class="wrap">
      <button class="linkbtn" style="padding:0" onClick={back}>Back to menu</button>
      <h1>Your skill map</h1>
      <p class="sub">{FORMULA} A skill needs {MIN_ANSWERS} answers before it gets a number. Built from {st.answers.length} answers on this device.</p>

      {(slow.length > 0 || misses.length > 0) && (
        <div class="note"><b>Pacing coach.</b>{' '}
          {slow.length > 0 && <>Right but slow: {slow.map(s => `${s.label} (${secs(s.avgMs!)} against a ${secs(s.budgetMs)} budget)`).join(', ')}. </>}
          {misses.length > 0 && <>{misses.length} timed miss{misses.length > 1 ? 'es' : ''} in the last 30 days took more than twice the budget: spending longer did not help, so skip and come back.</>}
        </div>)}

      {(['rw', 'math'] as Section[]).map(sec => (
        <section>
          <h2>{SPEC[sec].name}</h2>
          {SPEC[sec].order.map(dom => {
            const rows = stats.filter(s => s.sec === sec && s.dom === dom).sort((a, b) => (a.mastery ?? 2) - (b.mastery ?? 2));
            if (!rows.length) return null;
            return (
              <div class="tablewrap"><table class="brk skills">
                <caption style="text-align:left;font-weight:700;padding:10px 0 2px">{DOMNAME[dom]}</caption>
                <thead><tr><th>Skill</th><th>Mastery</th><th>Answers</th><th>Avg time</th><th>Why missed</th><th><span class="sr-only">Practice</span></th></tr></thead>
                <tbody>{rows.map(s => <Row s={s} />)}</tbody>
              </table></div>);
          })}
        </section>))}
    </div></div>);
}

function Row({ s }: { s: SkillStat }) {
  const b = band(s.mastery, s.easyOnly);
  const tags = TAGS.filter(t => s.tags[t]).map(t => `${TAG_LABEL[t as Tag]} ${s.tags[t]}`).join(', ');
  return (
    <tr>
      <td>{s.label}</td>
      <td>{s.mastery == null ? <span class="hint">{BAND_LABEL[b]}</span>
        : <><span class="meter" aria-hidden="true"><i style={{ width: Math.round(100 * s.mastery) + '%' }} /></span> {Math.round(100 * s.mastery)}% <span class="hint">{BAND_LABEL[b]}</span></>}</td>
      <td>{s.n}</td>
      <td>{s.avgMs == null ? <span class="hint">{s.n ? 'untimed only' : ''}</span>
        : <span class={s.avgMs > 1.3 * s.budgetMs ? 'slowtxt' : ''}>{secs(s.avgMs)} <span class="hint">/ {secs(s.budgetMs)}</span></span>}</td>
      <td class="hint">{tags}</td>
      <td>{s.available > 0 && <button class="linkbtn" onClick={() => startCustom(s.sec, [s.dom], ['E', 'M', 'H'], 10, [s.key], null, state.value.settings.tutor)}>
        Drill<span class="sr-only"> {s.label}</span></button>}</td>
    </tr>);
}
