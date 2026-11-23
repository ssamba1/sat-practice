import { render } from 'preact';
import './ui/theme.css';
import { App } from './ui/App';
import { boot } from './ui/store';

render(<App />, document.getElementById('app')!);
boot();

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* offline shell is a bonus */ });
