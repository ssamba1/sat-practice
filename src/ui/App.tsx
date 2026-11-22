import { useEffect } from 'preact/hooks';
import { screen, state, storageWarn, notice, fatal, loading, bootMsg, bootError, boot, indexStale, session, exitSession } from './store';
import { Menu } from './Menu';
import { SessionView } from './SessionView';
import { Results } from './Results';
import { VocabDrill } from './Vocab';
import { loadBundleFile } from './data';

export function App() {
  const theme = state.value.settings.theme;
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const s = screen.value;
  return (
    <>
      {storageWarn.value && <div class="banner" role="alert">Your browser would not save progress (storage is full or blocked). This session still works, but it may not be kept.</div>}
      {indexStale.value && s === 'menu' && <div class="banner">College Board did not respond, so this is the last saved copy of the question list.</div>}
      {s === 'boot' && <Boot />}
      {s === 'error' && <BootError />}
      {s === 'menu' && <Menu />}
      {s === 'session' && <SessionView />}
      {s === 'results' && <Results />}
      {s === 'vocab' && <VocabDrill />}
      {loading.value && <Loading />}
      {fatal.value && (
        <div class="navpop" role="alertdialog" aria-modal="true" aria-label="Problem">
          <div class="navcard"><h3>Something went wrong</h3><p>{fatal.value.msg}</p>
            <div class="btnrow" style="justify-content:center">
              <button class="navbtn" onClick={fatal.value.retry}>Try again</button>
              {session.value && <button class="navbtn ghost" onClick={exitSession}>Save and exit</button>}
            </div></div>
        </div>)}
      {notice.value && (
        <div class="toast" role="status"><span>{notice.value}</span><button onClick={() => { notice.value = null; }}>OK</button></div>)}
    </>
  );
}

function Boot() {
  return <div class="center"><div class="bootcard"><h1>SAT Practice</h1>
    <p class="sub">{bootMsg.value}</p><div class="pbar idle"><i /></div></div></div>;
}

function BootError() {
  return <div class="center"><div class="bootcard">
    <h1>SAT Practice</h1>
    <p class="sub">{bootError.value}</p>
    <button class="navbtn" onClick={boot}>Try again</button>
    <p class="hint" style="margin-top:22px">If the question bank has gone behind a login for good, you can still run this from
      a bundle you made yourself with <code>scripts/refresh_questions.py</code>:</p>
    <input type="file" accept=".js,.json" aria-label="Load a question bundle" onChange={e => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (f) loadBundleFile(f);
    }} />
  </div></div>;
}

function Loading() {
  const l = loading.value!;
  return <div class="navpop" aria-live="polite"><div class="navcard" style="text-align:center">
    <p>{l.msg}</p>
    <div class="pbar"><i style={{ width: (l.total ? 100 * l.done / l.total : 0) + '%' }} /></div>
    <p class="hint" style="margin-top:8px">{l.done} of {l.total}</p>
  </div></div>;
}
