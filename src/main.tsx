import { render } from 'preact';
import './ui/theme.css';
import { App } from './ui/App';
import { boot } from './ui/store';

render(<App />, document.getElementById('app')!);
boot();

// the bundle's hashed name changes with every deploy, which makes the browser reinstall the worker
const build = encodeURIComponent(new URL(import.meta.url).pathname.split('/').pop()!);
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js?b=' + build).catch(() => { /* the offline shell is a bonus */ });
