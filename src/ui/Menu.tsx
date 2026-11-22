import { useState, useEffect } from 'preact/hooks';
import type { Diff, Section } from '../api/questions';
import { SPEC, DOMNAME } from '../bank/spec';
import { pool, skillsByDomain, customPool } from '../bank/build';
import { dueItems } from '../review/schedule';
import { domainProgress } from '../stats/summary';
import { vocabProgress } from '../vocab/leitner';
import type { Settings } from '../store/state';
import {
  state, index, update, startFull, startModule, startCustom, startMistakes, savedSession, resumeSaved,
  discardSaved, screen, mistakeMetas,
} from './store';
import { downloadBackup, restoreFile, cacheAll, cachedCount } from './data';
import { TodayCard } from './Today';

const setSetting = (patch: Partial<Settings>) => update(s => ({ ...s, settings: { ...s.settings, ...patch } }));
const pct = (ok: number, n: number) => n ? Math.round(100 * ok / n) + '%' : '';
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function Menu() {
  const st = state.value, idx = index.value!, set = st.settings;
  const saved = savedSession();
  const due = dueItems(st.review, Date.now()).length, totalMiss = Object.keys(st.review).length;
  const vp = vocabProgress(st.vocab);
  const safe = { rw: pool(idx, 'rw', true).length, math: pool(idx, 'math', true).length };
  const [confirmOff, setConfirmOff] = useState(false);

  return (
    <div class="screen"><div class="wrap">
      <div class="menuhead">
        <h1>SAT Practice</h1>
        <span class="spacer" />
        <label>
          <span class="sr-only">Theme</span>
          <select value={set.theme} onChange={e => setSetting({ theme: (e.target as HTMLSelectElement).value as Settings['theme'] })}>
            <option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <p class="sub">Timed digital SAT practice on College Board's own question bank, with official explanations.</p>

      {saved && (
        <div class="cards" style="margin-bottom:22px">
          <button class="card resume" onClick={resumeSaved}>
            <b>Resume: {saved.label}</b>
            <span>Saved {ago(Date.now() - saved.at)}. Your clock paused while you were away.</span>
          </button>
          <button class="card" onClick={() => { if (confirm('Discard the saved session?')) { discardSaved(); update(s => ({ ...s })); } }}>
            <b>Discard it</b><span>Start fresh instead.</span>
          </button>
        </div>)}

      <TodayCard />

      <div class={'guard' + (set.noActive ? '' : ' off')}>
        <label>
          <input type="checkbox" checked={set.noActive} onChange={e => {
            const on = (e.target as HTMLInputElement).checked;
            if (on) { setSetting({ noActive: true }); setConfirmOff(false); } else setConfirmOff(true);
          }} />
          <span><b>Exclude active questions</b>
            <em>College Board flags some questions as still in use on test forms. Leaving them out keeps the official
              practice tests unspoiled. {safe.rw} Reading and Writing and {safe.math} Math questions remain.</em></span>
        </label>
        {confirmOff && set.noActive && (
          <div class="danger">These questions can appear in Bluebook practice tests you have not taken yet.{' '}
            <button class="linkbtn" onClick={() => { setSetting({ noActive: false }); setConfirmOff(false); }}>Include them anyway</button>
            <button class="linkbtn" onClick={() => setConfirmOff(false)}>Keep them out</button></div>)}
      </div>

      <h2>Test day</h2>
      <div class="cards">
        <button class="card" onClick={startFull}><b>Full-length test</b>
          <span>98 questions: two Reading and Writing modules, a 10-minute break, two Math modules. Module 2 adapts to Module 1.</span></button>
        <button class="card" onClick={() => startModule('rw')}><b>Reading and Writing module</b><span>27 questions, 32 minutes.</span></button>
        <button class="card" onClick={() => startModule('math')}><b>Math module</b><span>22 questions, 35 minutes, calculator and reference sheet.</span></button>
      </div>

      <h2>Practice</h2>
      <div class="cards">
        <button class="card mistakes" disabled={!totalMiss} onClick={() => startMistakes(Math.min(22, mistakeMetas(22).length), set.tutor)}>
          <b>Your mistakes</b>
          <span>{totalMiss ? `${due} due for review now, ${totalMiss} in total. A question leaves once you get it right on two different days.` : 'Questions you miss land here for spaced review.'}</span>
        </button>
        <button class="card vocab" onClick={() => { screen.value = 'vocab'; }}><b>Vocabulary</b>
          <span>12 words, about three minutes. {vp.known} of {vp.total} known, {vp.seen - vp.known} still settling.</span></button>
      </div>

      <CustomDrill tutor={set.tutor} />
      <Progress />
      <YourData />

      <p class="note">Not affiliated with College Board. SAT and Bluebook are registered trademarks of College Board.
        Questions are fetched by your browser from College Board and cached on this device. Based on{' '}
        <a href="https://github.com/Svitek0/moduledrill" target="_blank" rel="noopener">ModuleDrill</a> by Martin Svítek.</p>
    </div></div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: any }) {
  return <button type="button" class="chip" aria-pressed={on} onClick={onClick}>{children}</button>;
}
const toggle = <T,>(list: T[], v: T) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];

function CustomDrill({ tutor }: { tutor: boolean }) {
  const idx = index.value!, noActive = state.value.settings.noActive;
  const [sec, setSec] = useState<Section>('math');
  const [doms, setDoms] = useState<string[]>(SPEC.math.order);
  const [skills, setSkills] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<Diff[]>(['E', 'M', 'H']);
  const [n, setN] = useState(10);
  const perQ = SPEC[sec].mins / SPEC[sec].qs;
  const [mins, setMins] = useState(Math.round(10 * perQ));
  const [minsTouched, setMinsTouched] = useState(false);
  useEffect(() => { if (!minsTouched) setMins(Math.round(n * perQ)); }, [n, sec]);

  const sk = skillsByDomain(idx, sec, doms, noActive);
  const avail = customPool(idx, sec, doms, diffs, skills, noActive).length;
  const pickSec = (s: Section) => { setSec(s); setDoms(SPEC[s].order); setSkills([]); };

  return (
    <>
      <h2>Custom drill</h2>
      <fieldset><legend>Section</legend><div class="chips">
        {(['rw', 'math'] as Section[]).map(s => <Chip on={sec === s} onClick={() => pickSec(s)}>{SPEC[s].name}</Chip>)}
      </div></fieldset>
      <fieldset><legend>Domains</legend><div class="chips">
        {SPEC[sec].order.map(d => <Chip on={doms.includes(d)} onClick={() => { setDoms(toggle(doms, d)); setSkills([]); }}>{DOMNAME[d]}</Chip>)}
      </div></fieldset>
      <fieldset><legend>Skills</legend>
        <p class="hint">Leave all off to include every skill in the chosen domains. Numbers are questions available.</p>
        {Object.entries(sk).map(([dom, list]) => (
          <div class="skillgroup"><h4>{DOMNAME[dom]}</h4><div class="chips">
            {list.map(([k, v]) => <Chip on={skills.includes(k)} onClick={() => setSkills(toggle(skills, k))}>{v.label}<small>{v.n}</small></Chip>)}
          </div></div>))}
      </fieldset>
      <fieldset><legend>Difficulty and length</legend>
        <div class="row">
          <div class="chips">{(['E', 'M', 'H'] as Diff[]).map(d => <Chip on={diffs.includes(d)} onClick={() => setDiffs(toggle(diffs, d))}>{{ E: 'Easy', M: 'Medium', H: 'Hard' }[d]}</Chip>)}</div>
          <label>Questions <input type="number" min={1} max={60} value={n} onInput={e => setN(Math.max(1, Math.min(60, +(e.target as HTMLInputElement).value || 1)))} /></label>
          <label>Minutes <input type="number" min={0} max={180} value={mins} onInput={e => { setMinsTouched(true); setMins(Math.max(0, +(e.target as HTMLInputElement).value || 0)); }} /></label>
          <span class="hint" style="margin:0">0 minutes means untimed</span>
        </div>
        <label class="row" style="margin-top:12px">
          <input type="checkbox" checked={tutor} onChange={e => setSetting({ tutor: (e.target as HTMLInputElement).checked })} />
          Check each answer as I go (shows the explanation and locks the answer)
        </label>
      </fieldset>
      <div class="btnrow">
        <button class="navbtn" disabled={!avail || !doms.length || !diffs.length}
          onClick={() => startCustom(sec, doms, diffs, n, skills, mins || null, tutor)}>Start drill</button>
        <span class={'hint' + (avail < n ? ' short' : '')} style="margin:0">
          {avail} questions match{avail < n ? `, so the drill will have ${avail}` : ''}.</span>
      </div>
    </>
  );
}

function Progress() {
  const sessions = state.value.sessions.filter(s => Object.keys(s.doms || {}).length);
  if (sessions.length < 2) return null;
  const p = domainProgress(sessions, 5);
  return (
    <>
      <h2>Progress by domain</h2>
      <div class="tablewrap"><table class="brk">
        <thead><tr><th>Domain</th><th>All sessions</th><th>Last 5</th></tr></thead>
        <tbody>{Object.entries(p).map(([dom, r]) => (
          <tr><td>{dom}</td><td>{pct(...r.all)} <span class="hint">({r.all[0]}/{r.all[1]})</span></td>
            <td>{pct(...r.recent)} <span class="hint">({r.recent[0]}/{r.recent[1]})</span></td></tr>))}
        </tbody></table></div>
    </>
  );
}

function YourData() {
  const [cached, setCached] = useState<number | null>(null);
  useEffect(() => { cachedCount().then(setCached); }, []);
  const total = index.value ? index.value.rw.length + index.value.math.length : 0;
  return (
    <>
      <h2>Your data</h2>
      <p class="hint">Everything stays in this browser. Move it to another device with a backup file.</p>
      <div class="btnrow">
        <button class="navbtn ghost" onClick={downloadBackup}>Download backup</button>
        <label class="navbtn ghost" style="display:inline-block">
          Restore or import from ModuleDrill
          <input type="file" accept=".json,application/json" class="sr-only" onChange={e => {
            const f = (e.target as HTMLInputElement).files?.[0]; if (f) restoreFile(f); (e.target as HTMLInputElement).value = '';
          }} />
        </label>
        <button class="navbtn ghost" onClick={async () => { await cacheAll(); setCached(await cachedCount()); }}>
          Save all questions for offline use</button>
        {cached != null && <span class="hint" style="margin:0">{cached} of {total} saved on this device.</span>}
      </div>
    </>
  );
}
