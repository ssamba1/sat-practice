import { useState } from 'preact/hooks';
import { VOCAB } from '../data/vocab';
import { buildVocab, recordVocab, vocabProgress, BOX_MAX } from '../vocab/leitner';
import { shuffle } from '../bank/build';
import { screen, state, update } from './store';

export function VocabDrill() {
  const [items] = useState(() => buildVocab(state.value.vocab));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [order] = useState(() => items.map(() => shuffle([0, 1, 2, 3])));
  const back = () => { screen.value = 'menu'; };

  if (i >= items.length) {
    const p = vocabProgress(state.value.vocab);
    return <div class="screen"><div class="wrap vocabwrap">
      <h1>{score} of {items.length}</h1>
      <p class="sub">{p.known} of {p.total} words known ({BOX_MAX} correct in a row), {p.seen - p.known} still settling.</p>
      <button class="navbtn" onClick={back}>Back to menu</button>
    </div></div>;
  }

  const it = items[i], g = VOCAB.groups[it.gi];
  // w2d: show the word, pick its meaning. d2w: show the meaning, pick the word.
  const prompt = it.dir === 'w2d' ? g.w[it.wi] : g.d[it.wi];
  const choices = order[i].map(k => ({ k, text: it.dir === 'w2d' ? g.d[k] : g.w[k] }));
  const choose = (k: number) => {
    if (picked != null) return;
    setPicked(k);
    const ok = k === it.wi;
    if (ok) setScore(sc => sc + 1);
    update(s => ({ ...s, vocab: recordVocab(s.vocab, it.word, ok, Date.now()) }));
  };

  return (
    <div class="screen"><div class="wrap vocabwrap">
      <div class="vocabtop">
        <button class="linkbtn" onClick={back}>Exit</button>
        <div class="vprog" aria-hidden="true"><i style={{ width: 100 * i / items.length + '%' }} /></div>
        <span class="hint" style="margin:0">{i + 1} / {items.length}</span>
      </div>
      <p class="vask">{it.dir === 'w2d' ? 'What does this word mean?' : 'Which word means this?'}</p>
      <div class={'vprompt' + (it.dir === 'w2d' ? ' isword' : '')}>{prompt}</div>
      <div role="radiogroup">{choices.map(c => (
        <button class={'vopt' + (picked == null ? '' : c.k === it.wi ? ' right' : c.k === picked ? ' wrong' : ' dim')}
          disabled={picked != null} onClick={() => choose(c.k)}>{c.text}</button>))}
      </div>
      {picked != null && <>
        <div class={'vfeed' + (picked === it.wi ? '' : ' no')} role="status">
          <b>{g.w[it.wi]}</b>: {g.d[it.wi]}
          {picked !== it.wi && <><br /><b>{g.w[picked]}</b>: {g.d[picked]}</>}
        </div>
        <button class="navbtn" autoFocus onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 < items.length ? 'Next' : 'Finish'}</button>
      </>}
    </div></div>);
}
