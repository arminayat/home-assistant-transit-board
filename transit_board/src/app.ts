import 'transit-board-core/src/index.ts';
import { BoardSession } from './session.ts';
import type { BoardConfig } from 'transit-board-core/src/types.ts';

type ConfigElement = HTMLElement & { setConfig(value: unknown): void };

const required = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing App element: ${id}`);
  return node as T;
};
const board = document.createElement('transit-board-card') as ConfigElement;
const editor = document.createElement('transit-board-card-editor') as ConfigElement;
const boardHost = required('board');
const editorHost = required('editor');
const settings = required<HTMLButtonElement>('settings');
const save = required<HTMLButtonElement>('save');
const cancel = required<HTMLButtonElement>('cancel');
const reload = required<HTMLButtonElement>('reload');
const panel = required('settings-panel');
const status = required('status');
const error = required('error');
const intro = required('intro');
const warning = required('shared-change');
const retry = required<HTMLButtonElement>('retry');
let editing = false;
let firstLoad = true;
let editorConfig: BoardConfig | undefined;
let disposed = false;
const session = new BoardSession(render);

function render(): void {
  if (disposed) return;
  if (session.saved && firstLoad) {
    firstLoad = false;
    editing = session.saved.config.stops.length === 0;
  }
  intro.hidden = !session.saved || session.saved.config.stops.length > 0;
  panel.hidden = !editing || !session.saved;
  settings.disabled = !session.saved || session.saving;
  settings.setAttribute('aria-expanded', String(editing));
  settings.hidden = editing;
  save.disabled = session.saving || !session.dirty || Boolean(session.validationError) || Boolean(session.remote);
  cancel.disabled = session.saving;
  reload.disabled = session.loading || session.saving;
  retry.hidden = !session.error || session.saving;
  retry.disabled = session.loading;
  status.textContent = session.saving ? 'Saving…' : session.notice || (session.dirty ? 'Unsaved changes — preview only.' :
    session.loading && !session.saved ? 'Loading your board…' : '');
  error.textContent = session.validationError || session.error;
  error.hidden = !error.textContent;
  warning.hidden = !session.remote;
  if (!session.saved || !session.draft) return;
  const config = editing ? session.draft : session.saved.config;
  board.setConfig(config);
  if (!board.isConnected) boardHost.append(board);
  if (editing) {
    if (editorConfig !== session.draft && !session.validationError) {
      editor.setConfig(session.draft);
      editorConfig = session.draft;
    }
    if (!editor.isConnected) editorHost.append(editor);
  } else {
    editor.remove();
    editorConfig = undefined;
  }
}

settings.addEventListener('click', () => { editing = true; render(); editorHost.scrollIntoView?.({ block: 'nearest' }); });
editor.addEventListener('config-changed', (event) => {
  // The component retains its own field/search focus; never rebuild it on each keystroke.
  session.edit((event as CustomEvent<{ config: unknown }>).detail.config);
  editorConfig = session.draft;
});
save.addEventListener('click', () => { void session.save(); });
cancel.addEventListener('click', () => { session.cancel(); editing = false; render(); settings.focus(); });
reload.addEventListener('click', () => {
  if (!session.dirty || window.confirm('Discard your unsaved changes and load the saved board?')) void session.reload();
});
retry.addEventListener('click', () => { void session.refresh(); });
const refresh = (): void => { if (!document.hidden && !disposed) void session.refresh(); };
const beforeUnload = (event: BeforeUnloadEvent): void => {
  if (session.dirty || session.saving) { event.preventDefault(); event.returnValue = ''; }
};
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', refresh);
window.addEventListener('beforeunload', beforeUnload);
const timer = setInterval(refresh, 60_000);
window.addEventListener('pagehide', () => {
  disposed = true;
  clearInterval(timer);
  window.removeEventListener('focus', refresh);
  document.removeEventListener('visibilitychange', refresh);
  window.removeEventListener('beforeunload', beforeUnload);
  board.remove();
  editor.remove();
});
// Browsers may restore an ingress page from their back/forward cache after pagehide.
window.addEventListener('pageshow', (event) => { if (event.persisted && disposed) window.location.reload(); });
render();
void session.refresh();
