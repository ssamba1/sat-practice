import { render } from 'preact';
import './ui/theme.css';
import { App } from './ui/App';
import { boot } from './ui/store';

render(<App />, document.getElementById('app')!);
boot();
