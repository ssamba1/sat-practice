import { useEffect, useRef, useState } from 'preact/hooks';
import type { Question } from '../api/questions';
import { cleanGridIn, isCorrect, LETTERS } from '../score/check';
import {
  answer, goTo, toReview, submitModule, toggleMark, strike, setHl, check, toggleAbc, currentStage, currentQs, secOf, fmt, clockView,
  type Session,
} from '../session/machine';
import { session, act, exitSession, state, update, focusOnMount } from './store';
import { markSelection } from './highlight';
import { Calculator } from './Calculator';

const ROUTE: Record<string, string> = {
  m2hard: 'Harder Module 2 (approximate routing: 60%+ on Module 1)',
  m2easy: 'Easier Module 2 (approximate routing: under 60% on Module 1)',
};

export function SessionView() {
  const s = session.value;
  const [hideClock, setHideClock] = useState(false);
  const [hlOn, setHlOn] = useState(false);
  const [calc, setCalc] = useState(false);
  const [pop, setPop] = useState<null | 'nav' | 'ref'>(null);
  useEffect(() => setPop(null), [s?.stage]);   // a panel from the last module never carries over
  const opener = useRef<HTMLElement | null>(null);
  const openPop = (p: 'nav' | 'ref') => { opener.current = document.activeElement as HTMLElement; setPop(p); };
  const closePop = () => { setPop(null); opener.current?.focus(); };   // back to the button that opened it
  if (!s) return null;
  const st = currentStage(s), qs = currentQs(s);

  if (s.view === 'break') return (
    <div class="center" role="main">
      <h1>Break</h1>
      <div class="clock" aria-live="off">{fmt(s.remainingMs ?? 0)}</div>
      <p class="sub">Math starts when the break ends, or when you are ready.</p>
      <button class="navbtn" onClick={() => act(submitModule)}>Resume testing</button>
    </div>);
  if (!qs) return <div class="center"><p class="sub">Preparing {st.label}</p></div>;

  const q = qs[s.idx];
  const isMath = secOf(q.dom) === 'math';
  const clock = s.remainingMs == null ? null : clockView(s.remainingMs, st.kind === 'module' && !!st.soft);
  const route = st.kind === 'module' && st.route ? ROUTE[st.route] : '';

  return (
    <>
      <header class="bar">
        <div class="hleft">{st.label}<small>{route || (s.tutor ? 'Checking each answer as you go' : 'Directions apply as on test day')}</small></div>
        <div class="timerwrap">
          {s.remainingMs == null ? <div class="timer" style="font-size:15px">Untimed</div>
            : !hideClock && clock && <div class={'timer' + (clock.low ? ' low' : '') + (clock.over ? ' over' : '')} role="timer" aria-label="Time remaining">{clock.text}</div>}
          {s.remainingMs != null && <button class="tbtn" onClick={() => setHideClock(!hideClock)}>{hideClock ? 'Show' : 'Hide'}</button>}
        </div>
        <div class="hright">
          {s.view === 'q' && <button id="hlbtn" class="tool" aria-pressed={hlOn} onClick={() => setHlOn(!hlOn)} title="Highlight (Ctrl+H)">
            <span class="ic" aria-hidden="true">&#x270E;</span>Highlight</button>}
          {isMath && <button class="tool" aria-pressed={calc} onClick={() => setCalc(!calc)}><span class="ic" aria-hidden="true">&#x1F5A9;</span>Calculator</button>}
          {isMath && <button class="tool" onClick={() => openPop('ref')}><span class="ic" aria-hidden="true">&#x2211;</span>Reference</button>}
          <button class="tool" onClick={() => { if (confirm('Save this session and go back to the menu? You can resume it later.')) exitSession(); }}>
            <span class="ic" aria-hidden="true">&#x23CF;</span>Save and exit</button>
        </div>
      </header>

      {s.view === 'review' ? <ReviewPage s={s} /> : <QuestionView s={s} q={q} hlOn={hlOn} />}

      <footer class="bar">
        <span class="hint" style="margin:0">{s.view === 'q' ? '' : 'Check your work'}</span>
        <button class="qpick" onClick={() => openPop('nav')} aria-haspopup="dialog">
          {s.view === 'review' ? 'Questions' : `Question ${s.idx + 1} of ${qs.length}`} &#x25B4;</button>
        <div class="footright">
          {s.view === 'q' ? <>
            <button class="navbtn ghost" id="back" disabled={s.idx === 0} onClick={() => act((x, t) => goTo(x, x.idx - 1, t))}>Back</button>
            <button class="navbtn" id="next" onClick={() => act((x, t) => x.idx < qs.length - 1 ? goTo(x, x.idx + 1, t) : toReview(x, t))}>Next</button>
          </> : <>
            <button class="navbtn ghost" onClick={() => act((x, t) => goTo(x, qs.length - 1, t))}>Back</button>
            <button class="navbtn" onClick={() => {
              const left = s.resp[s.stage].filter(r => r == null || r === '').length;
              if (!left || confirm(`${left} question${left > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) act(submitModule);
            }}>{s.stage === s.stages.length - 1 ? 'Finish' : 'Submit module'}</button>
          </>}
        </div>
      </footer>

      {pop === 'nav' && <Navigator s={s} close={closePop} />}
      {pop === 'ref' && <Reference close={closePop} />}
      {calc && isMath && <Calculator close={() => setCalc(false)} pos={state.value.settings.calc}
        onMove={calcPos => update(x => ({ ...x, settings: { ...x.settings, calc: calcPos } }))} />}
      <Keys s={s} q={q} toggleHl={() => setHlOn(v => !v)} popOpen={!!pop} closePop={closePop} />
    </>
  );
}

function QuestionView({ s, q, hlOn }: { s: Session; q: Question; hlOn: boolean }) {
  const hl = s.hl[s.stage][s.idx];
  const resp = s.resp[s.stage][s.idx];
  const checked = s.checked[s.stage][s.idx];
  const struck = s.struck[s.stage][s.idx];
  const marked = s.marked[s.stage][s.idx];
  const sti = hl?.sti ?? q.sti, stem = hl?.stem ?? q.stem;
  const stiRef = useRef<HTMLDivElement>(null), stemRef = useRef<HTMLDivElement>(null);

  const save = () => act(x => setHl(x, { sti: stiRef.current ? stiRef.current.innerHTML : null, stem: stemRef.current!.innerHTML }));
  const onUp = (root: HTMLElement | null) => { if (hlOn && root && markSelection(root)) save(); };
  const onClick = (e: MouseEvent) => {
    const m = (e.target as HTMLElement).closest('mark.hl');
    if (!m) return;
    const root = m.parentElement!;
    m.replaceWith(...Array.from(m.childNodes));
    root.normalize();
    save();
  };
  const ok = checked && isCorrect(q, resp);

  const body = (
    <>
      <div class="qhead">
        <div class="qnum">{s.idx + 1}</div>
        <div class="acts">
          <button class="markbtn" aria-pressed={marked} onClick={() => act(toggleMark)}>{marked ? '⚑' : '⚐'} Mark for Review</button>
          {q.type === 'mcq' && <button class="abcbtn" aria-pressed={s.abc} title="Cross out answer choices" onClick={() => act(toggleAbc)}>
            <span style="text-decoration:line-through">ABC</span></button>}
        </div>
      </div>
      <div class="stem" ref={stemRef} onPointerUp={() => onUp(stemRef.current)} onClick={onClick} dangerouslySetInnerHTML={{ __html: stem }} />
      {q.type === 'spr' ? <GridIn resp={resp} locked={checked} />
        : <ul class={'opts' + (s.abc ? ' abcmode' : '')} role="radiogroup" aria-label="Answer choices">
          {q.opts.map((o, i) => (
            <li>
              <button role="radio" aria-checked={resp === i} disabled={checked}
                class={'opt' + (resp === i ? ' sel' : '') + (struck.includes(i) ? ' struck' : '')
                  + (checked ? (q.ans.includes(LETTERS[i]) ? ' correct' : resp === i ? ' wrong' : '') : '')}
                onClick={() => act(x => answer(x, resp === i ? null : i))}>
                <span class="ltr">{LETTERS[i]}</span><span class="body" dangerouslySetInnerHTML={{ __html: o }} />
                {struck.includes(i) && <span class="sr-only">, crossed out</span>}
              </button>
              {s.abc && <button class="strikecol" aria-label={`Cross out ${LETTERS[i]}`} aria-pressed={struck.includes(i)} onClick={() => act(x => strike(x, i))}>{LETTERS[i]}</button>}
            </li>))}
        </ul>}
      {s.tutor && !checked && <div class="btnrow" style="margin-top:16px">
        <button id="check" class="navbtn ghost" disabled={resp == null || resp === ''} onClick={() => act(check)}>Check</button></div>}
      {checked && <>
        <p class={'verdict ' + (ok ? 'ok' : 'no')} role="status">{ok ? 'Correct.' : `Not quite. Correct answer: ${q.ans.join(' or ')}`}</p>
        <div class="rat" dangerouslySetInnerHTML={{ __html: q.rat }} />
      </>}
    </>
  );
  return (
    <main class={'q' + (hlOn ? ' hlon' : '')}>
      {sti ? <div class="split">
        <div class="pane left"><div class="stim" ref={stiRef} onPointerUp={() => onUp(stiRef.current)} onClick={onClick} dangerouslySetInnerHTML={{ __html: sti }} /></div>
        <div class="pane right">{body}</div>
      </div> : <div class="pane solo">{body}</div>}
    </main>
  );
}

function GridIn({ resp, locked }: { resp: Session['resp'][0][0]; locked: boolean }) {
  const v = resp == null ? '' : String(resp);
  return (
    <div class="sprwrap">
      <label class="sr-only" for="sprin">Your answer</label>
      <input id="sprin" type="text" inputMode="decimal" autocomplete="off" spellcheck={false} disabled={locked} value={v} placeholder="Type answer"
        onInput={e => {
          const el = e.target as HTMLInputElement, c = cleanGridIn(el.value);
          if (c !== el.value) el.value = c;
          act(x => answer(x, c));
        }} />
      <div class="sprprev" aria-live="polite">{v ? 'Answer preview: ' + v : ''}</div>
      <div class="sprprev">Fractions like <code>3/4</code> and decimals both count. Up to 5 characters, 6 for a negative answer
        with a leading minus. No commas, % or $ signs.</div>
    </div>);
}

function Navigator({ s, close }: { s: Session; close: () => void }) {
  const qs = currentQs(s)!;
  return (
    <div class="navpop" role="dialog" aria-modal="true" aria-label="Question navigator" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div class="navcard">
        <h3>{currentStage(s).label}</h3>
        <div class="legend"><span>&#x25A0; Answered</span><span>&#x2B1A; Unanswered</span><span style="color:var(--mark)">&#x2691; For review</span></div>
        <div class="grid">{qs.map((_, i) => {
          const r = s.resp[s.stage][i];
          return <button class={'gcell' + (r != null && r !== '' ? ' done' : '') + (s.marked[s.stage][i] ? ' mk' : '') + (s.view === 'q' && i === s.idx ? ' cur' : '')}
            aria-label={`Question ${i + 1}${s.marked[s.stage][i] ? ', marked for review' : ''}${r != null && r !== '' ? ', answered' : ''}`}
            onClick={() => { act((x, t) => goTo(x, i, t)); close(); }}>{i + 1}</button>;
        })}</div>
        <button class="navbtn go" onClick={() => { act(toReview); close(); }} ref={focusOnMount}>Go to Review Page</button>
      </div>
    </div>);
}

function ReviewPage({ s }: { s: Session }) {
  const qs = currentQs(s)!;
  const left = s.resp[s.stage].filter(r => r == null || r === '').length;
  const marks = s.marked[s.stage].filter(Boolean).length;
  return (
    <main class="q"><div class="pane solo">
      <h1>Check your work</h1>
      <p class="sub">On test day you would not be able to come back to this module after submitting.
        {left ? ` ${left} unanswered.` : ' Every question is answered.'}{marks ? ` ${marks} marked for review.` : ''}</p>
      <div class="grid">{qs.map((_, i) => {
        const r = s.resp[s.stage][i];
        return <button class={'gcell' + (r != null && r !== '' ? ' done' : '') + (s.marked[s.stage][i] ? ' mk' : '')}
          aria-label={`Question ${i + 1}`} onClick={() => act((x, t) => goTo(x, i, t))}>{i + 1}</button>;
      })}</div>
    </div></main>);
}

function Reference({ close }: { close: () => void }) {
  return (
    <div class="navpop" role="dialog" aria-modal="true" aria-label="Reference sheet" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div class="navcard" style="width:min(680px,94vw)">
        <h3>Reference</h3>
        <div style="font-size:14.5px;line-height:1.9;margin-top:14px">
          <p><b>Circle:</b> A = &pi;r&sup2;, C = 2&pi;r</p>
          <p><b>Rectangle:</b> A = &#x2113;w. <b>Triangle:</b> A = &frac12;bh</p>
          <p><b>Pythagorean theorem:</b> c&sup2; = a&sup2; + b&sup2;</p>
          <p><b>Special right triangles:</b> 30-60-90 sides x, x&radic;3, 2x. 45-45-90 sides s, s, s&radic;2</p>
          <p><b>Rectangular solid:</b> V = &#x2113;wh. <b>Cylinder:</b> V = &pi;r&sup2;h</p>
          <p><b>Sphere:</b> V = (4/3)&pi;r&sup3;. <b>Cone:</b> V = (1/3)&pi;r&sup2;h. <b>Pyramid:</b> V = (1/3)&#x2113;wh</p>
          <p>The number of degrees of arc in a circle is 360. The number of radians of arc in a circle is 2&pi;.
            The sum of the measures in degrees of the angles of a triangle is 180.</p>
        </div>
        <button class="navbtn go" onClick={close} ref={focusOnMount}>Close</button>
      </div>
    </div>);
}

function Keys({ s, q, toggleHl, popOpen, closePop }: { s: Session; q: Question; toggleHl: () => void; popOpen: boolean; closePop: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (popOpen && e.key === 'Escape') { closePop(); return; }
      if (s.view !== 'q') return;
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); toggleHl(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || popOpen) return;   // leave browser shortcuts alone
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (e.key === 'Enter') (document.getElementById('next') as HTMLButtonElement)?.click(); return; }
      if (e.key === 'ArrowRight') document.getElementById('next')?.click();
      else if (e.key === 'ArrowLeft') { const b = document.getElementById('back') as HTMLButtonElement; if (b && !b.disabled) b.click(); }
      else if (q.type === 'mcq' && /^[a-d]$/i.test(e.key)) {
        const i = 'abcd'.indexOf(e.key.toLowerCase());
        act(x => answer(x, x.resp[x.stage][x.idx] === i ? null : i));
      } else if (e.key.toLowerCase() === 'm') act(toggleMark);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [s.view, q, popOpen]);
  return null;
}
