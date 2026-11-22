import { parseBundle } from '../api/bundle';
import { hydrate, type Meta } from '../api/questions';
import { backupJson, importBackup, importModuleDrill, mergeImported } from '../store/backup';
import { saveState } from '../store/state';
import { idb, index, screen, state, update, notice, loading, netMessage } from './store';

export async function loadBundleFile(file: File) {
  try {
    const { index: idx, bodies } = parseBundle(await file.text());
    await idb.putMany('body', bodies);
    // ts 0 keeps the index permanently stale: the live bank wins again once it answers
    await idb.put('meta', 'index', { ts: 0, data: idx });
    index.value = idx;
    screen.value = 'menu';
  } catch (e) {
    notice.value = `That file could not be read as a question bundle (${e instanceof Error ? e.message : e}).`;
  }
}

export function downloadBackup() {
  const blob = new Blob([backupJson(state.value, Date.now())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sat-practice-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);   // a slow device may fetch the blob late
}

/** Accepts this app's backup (replaces everything) or a ModuleDrill backup (merged in). */
export async function restoreFile(file: File) {
  let text: string, json: unknown;
  try { text = await file.text(); } catch { notice.value = 'That file could not be read. Close anything that has it open and try again.'; return; }
  try { json = JSON.parse(text); } catch { notice.value = 'That file is not a backup (it is not valid JSON).'; return; }
  const md = importModuleDrill(json, Date.now());
  if (!(md instanceof Error)) {
    const ok = confirm(`Import from ModuleDrill?\n\nThis adds: ${md.report.join(', ')}.\n\nYour skill map starts fresh: ModuleDrill did not keep per-question results. Nothing you already have here is removed.`);
    if (!ok) return;
    update(s => mergeImported(s, md.state));
    notice.value = 'Imported from ModuleDrill.';
    return;
  }
  const own = importBackup(json);
  if (own instanceof Error) { notice.value = 'That file is not a backup from this app or from ModuleDrill.'; return; }
  if (!confirm('Replace everything here with this backup? Your current history, mistakes and settings will be overwritten.')) return;
  state.value = own;
  if (!saveState(own).ok) notice.value = 'The backup was read, but your browser would not save it.';
  else notice.value = 'Backup restored.';
}

/** Fetch every usable question so the app works with no connection. */
export async function cacheAll() {
  const idx = index.value;
  if (!idx) return;
  const metas: Meta[] = [...idx.rw, ...idx.math];
  const msg = 'Saving every question for offline use';
  loading.value = { msg, done: 0, total: metas.length };
  try {
    // in chunks, so a dropped connection keeps everything saved before it
    for (let i = 0; i < metas.length; i += 100) {
      await hydrate(metas.slice(i, i + 100), idb);
      loading.value = { msg, done: Math.min(i + 100, metas.length), total: metas.length };
    }
    // bodies corrected some grid-in guesses in place; keep the index's own timestamp
    const cached = await idb.get('meta', 'index');
    await idb.put('meta', 'index', { ts: cached?.ts ?? 0, data: idx });
    notice.value = `All ${metas.length} questions are saved. The app now works offline, except the calculator.`;
  } catch (e) {
    notice.value = netMessage(e) + ' What was saved so far is kept.';
  } finally { loading.value = null; }
}

export const cachedCount = () => idb.count('body');
