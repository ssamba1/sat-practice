import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalcPos } from '../store/state';

const CALC_URL = 'https://www.desmos.com/testing/collegeboard/graphing';

/** Remembered geometry, clamped so it never opens off-screen. Defaults to the left, as in Bluebook. */
function geometry(d: Partial<CalcPos> = {}): CalcPos {
  const w = Math.min(Math.max(d.w || Math.min(520, innerWidth * 0.42), 280), Math.max(320, innerWidth - 20));
  const h = Math.min(Math.max(d.h || 560, 220), Math.max(240, innerHeight - 20));
  const x = Math.min(Math.max(d.x ?? 16, 0), Math.max(0, innerWidth - w));
  const y = Math.min(Math.max(d.y ?? 90, 0), Math.max(0, innerHeight - h));
  return { x, y, w, h };
}

/** Bluebook slides the question aside rather than covering it: pad <main> on the panel's side. */
function reflow(p: HTMLElement | null) {
  const main = document.querySelector<HTMLElement>('main.q');
  if (!main) return;
  main.style.paddingLeft = main.style.paddingRight = '';
  if (!p || innerWidth <= 760) return;
  const b = p.getBoundingClientRect();
  const room = Math.min(innerWidth * 0.45, b.width + 24);
  if (b.left + b.width / 2 < innerWidth / 2) main.style.paddingLeft = room + 'px';
  else main.style.paddingRight = room + 'px';
}

export function Calculator({ close, pos, onMove }: { close: () => void; pos?: CalcPos; onMove: (p: CalcPos) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [g] = useState(() => geometry(pos));
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>(navigator.onLine ? 'loading' : 'fail');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    reflow(ref.current);
    const r = () => {
      const el = ref.current;
      if (el) {   // a narrower window must not leave the panel off-screen
        const b = el.getBoundingClientRect(), n = geometry({ x: b.left, y: b.top, w: b.width, h: b.height });
        Object.assign(el.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px' });
      }
      reflow(el);
    };
    addEventListener('resize', r);
    return () => { removeEventListener('resize', r); reflow(null); };
  }, []);
  useEffect(() => {
    if (status !== 'loading') return;
    // a cross-origin frame never says why it failed, so "never loaded" counts as failure
    const t = setTimeout(() => setStatus(st => st === 'loading' ? 'fail' : st), 12000);
    return () => clearTimeout(t);
  }, [status, attempt]);

  // Track on window, not the handle: a fast pointer leaves a small grip before the gesture ends.
  const gesture = (onPointer: (e: PointerEvent) => void) => {
    const p = ref.current!;
    p.classList.add('busy');
    const up = () => {
      p.classList.remove('busy');
      removeEventListener('pointermove', onPointer); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      const b = p.getBoundingClientRect();
      onMove({ x: b.left, y: b.top, w: b.width, h: b.height });
      reflow(p);
    };
    addEventListener('pointermove', onPointer); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const drag = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('a, button') || innerWidth <= 760) return;
    e.preventDefault();
    const p = ref.current!, r = p.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    gesture(ev => {
      p.style.left = Math.min(Math.max(ev.clientX - dx, 0), innerWidth - r.width) + 'px';
      p.style.top = Math.min(Math.max(ev.clientY - dy, 0), innerHeight - r.height) + 'px';
    });
  };
  const resize = (e: PointerEvent) => {
    e.preventDefault();
    const p = ref.current!, r = p.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    gesture(ev => {
      p.style.width = Math.max(280, Math.min(r.width + ev.clientX - sx, innerWidth - r.left)) + 'px';
      p.style.height = Math.max(220, Math.min(r.height + ev.clientY - sy, innerHeight - r.top)) + 'px';
    });
  };

  return (
    <div class="calcpanel" ref={ref} role="dialog" aria-label="Calculator" style={{ left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' }}>
      <div class="calcbar" onPointerDown={drag}>
        <b>Calculator</b>
        <a href={CALC_URL} target="_blank" rel="noopener">Open in a tab</a>
        <button onClick={close} aria-label="Close calculator">&#x2715;</button>
      </div>
      <div class="calcbody">
        {status !== 'fail' && <iframe key={attempt} title="Desmos graphing calculator, College Board version" src={CALC_URL}
          onLoad={() => setStatus('ok')} />}
        {status === 'loading' && <div class="calcmsg"><b>Loading Desmos</b></div>}
        {status === 'fail' && <div class="calcmsg">
          <b>The calculator needs a connection</b>
          <div>Everything else works offline. Desmos is hosted by someone else, so it cannot be saved with the questions.
            Use a handheld calculator for now, or try again when you are back online.</div>
          <button class="navbtn ghost" onClick={() => { setStatus('loading'); setAttempt(a => a + 1); }}>Try again</button>
        </div>}
      </div>
      <div class="calcgrip" title="Drag to resize" onPointerDown={resize} />
    </div>);
}
