import './components.ts';
import { DEFAULT_CONFIG } from './card-config.ts';
import { BoardSession } from './session.ts';
import { MAX_CARDS } from './config.ts';
import type { TransitCardConfig } from './config.ts';
import { CardView, iconButton, type ConfigElement } from './card-view.ts';
import { applyEditorTheme } from './editor-theme.ts';

const required = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing App element: ${id}`);
  return node as T;
};
const cardsHost = required('cards');
const add = iconButton('Add card', 'add');
add.id = 'add-card';
required('add-card-host').append(add);
const addFirst = required<HTMLButtonElement>('add-first-card');
const editor = document.createElement('transit-board-card-editor') as ConfigElement;
applyEditorTheme(editor);
const editorHost = required('editor');
const save = required<HTMLButtonElement>('save');
const cancel = required<HTMLButtonElement>('cancel');
const remove = required<HTMLButtonElement>('remove-card');
const reload = required<HTMLButtonElement>('reload');
const panel = required('settings-panel');
const panelTitle = required('settings-heading');
const removalNotice = required('removal-notice');
const status = required('status');
const error = required('error');
const intro = required('intro');
const warning = required('shared-change');
const retry = required<HTMLButtonElement>('retry');
const capacity = required('capacity');
const views = new Map<string, CardView>();
let selected: string | undefined;
let editorConfig: string | undefined;
let formInvalid = false;
let editorGeneration = 0;
let disposed = false;
const session = new BoardSession(render);

function render(): void {
  if (disposed) return;
  const saved = session.saved?.config.cards ?? [];
  const draft = session.draft?.cards ?? [];
  const selectedDraft = draft.find((card) => card.id === selected);
  const selectedSaved = saved.find((card) => card.id === selected);
  if (selected && !selectedDraft && !selectedSaved) selected = undefined;
  const removed = Boolean(selectedSaved && !selectedDraft);
  const displayed = saved.map((card) => card.id === selected && selectedDraft ? selectedDraft : card);
  if (selectedDraft && !selectedSaved) displayed.push(selectedDraft);
  const full = saved.length >= MAX_CARDS;
  add.disabled = addFirst.disabled = !session.saved || session.saving || full;
  capacity.hidden = !full;
  capacity.textContent = `This dashboard can contain up to ${MAX_CARDS} cards.`;
  intro.hidden = !session.saved || displayed.length > 0;
  save.disabled = session.saving || !session.dirty || formInvalid || Boolean(session.validationError) || Boolean(session.remote);
  cancel.disabled = remove.disabled = session.saving;
  remove.hidden = removed;
  reload.disabled = session.loading || session.saving;
  retry.hidden = !session.error || session.saving;
  retry.disabled = session.loading;
  status.textContent = session.saving ? 'Saving…' : formInvalid ? 'Unsaved changes — preview only.' : session.notice || (session.dirty ? 'Unsaved changes — preview only.' :
    session.loading && !session.saved ? 'Loading your dashboard…' : '');
  error.textContent = session.validationError || (formInvalid ? 'Correct the highlighted fields before saving.' : '') || session.error;
  error.hidden = !error.textContent;
  warning.hidden = !session.remote;
  panel.hidden = !selected || !session.saved;
  panel.setAttribute('aria-busy', String(session.saving));
  removalNotice.hidden = !removed;
  panelTitle.textContent = removed ? 'Remove card' : 'Card settings';
  editorHost.hidden = removed;
  editor.inert = session.saving;
  editor.setAttribute('aria-disabled', String(session.saving));
  if (!selected && panel.parentElement !== cardsHost.parentElement) cardsHost.after(panel);

  const keep = new Set(displayed.map((card) => card.id));
  for (const [id, view] of views) {
    if (!keep.has(id)) { view.remove(); views.delete(id); }
  }
  displayed.forEach((card, index) => {
    let view = views.get(card.id);
    if (!view) { view = new CardView(card.id, openCard); views.set(card.id, view); }
    view.update(card, selected === card.id, selected === card.id && removed, session.saving);
    const current = cardsHost.children[index];
    if (current !== view.node) cardsHost.insertBefore(view.node, current ?? null);
    if (selected === card.id && panel.parentElement !== view.node) view.node.append(panel);
  });
  if (selectedDraft && !removed) {
    const signature = JSON.stringify(selectedDraft);
    if (editorConfig !== signature && !session.validationError && !formInvalid) {
      editor.setConfig(selectedDraft);
      editorConfig = signature;
    }
    if (editor.parentElement !== editorHost) editorHost.append(editor);
  } else {
    editor.remove();
    editorConfig = undefined;
  }
}

function discardBeforeSwitch(): boolean {
  if (!session.saved || session.saving) return false;
  if ((session.dirty || formInvalid) && !window.confirm('Discard your unsaved changes before opening another card?')) return false;
  selected = undefined;
  formInvalid = false;
  session.cancel();
  return true;
}

function openCard(id: string): void {
  if (selected === id || !discardBeforeSwitch()) return;
  selected = id;
  editorConfig = undefined;
  render();
  panel.scrollIntoView?.({ block: 'nearest' });
}

function addCard(): void {
  if (add.disabled || !discardBeforeSwitch()) return;
  // HA may run over plain HTTP, where randomUUID() is unavailable.
  selected = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const card: TransitCardConfig = { ...DEFAULT_CONFIG, stops: [], id: selected };
  editorConfig = undefined;
  session.edit({ cards: [...session.saved!.config.cards, card] });
  panel.scrollIntoView?.({ block: 'nearest' });
}

add.addEventListener('click', addCard);
addFirst.addEventListener('click', addCard);
// Bubble after the upstream field handlers, including invalid edits that emit no config.
const updateFormValidity = (): void => {
  editorGeneration += 1;
  formInvalid = [...editor.shadowRoot!.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')]
    .some((field) => field.getAttribute('aria-invalid') === 'true' || !field.validity.valid);
  if (formInvalid) session.invalidateRefresh();
  render();
};
editor.shadowRoot!.addEventListener('input', updateFormValidity);
editor.shadowRoot!.addEventListener('change', updateFormValidity);
editor.addEventListener('config-changed', (event) => {
  if (!selected || !session.draft || session.saving) return;
  editorGeneration += 1;
  const config = (event as CustomEvent<{ config: unknown }>).detail.config;
  const updated = config && typeof config === 'object' && !Array.isArray(config) ? { ...config, id: selected } : config;
  // The upstream editor owns focus/search state. Retain it across ordinary edits.
  session.edit({ cards: session.draft.cards.map((card) => card.id === selected ? updated : card) });
  const card = session.draft.cards.find((item) => item.id === selected);
  editorConfig = card && JSON.stringify(card);
});
save.addEventListener('click', () => {
  if (save.disabled || formInvalid) return;
  const previous = selected;
  void session.save().then(() => {
    if (disposed || session.saving || session.dirty || formInvalid || session.error || session.validationError || session.remote) return;
    if (selected && selected !== previous) return;
    selected = undefined;
    editorConfig = undefined;
    render();
    (previous && views.get(previous)?.settings || add).focus();
  });
});
cancel.addEventListener('click', () => {
  const previous = selected;
  selected = undefined;
  formInvalid = false;
  session.cancel();
  (previous && views.get(previous)?.settings || add).focus();
});
remove.addEventListener('click', () => {
  if (!selected || session.saving || !session.draft) return;
  if (!session.saved?.config.cards.some((card) => card.id === selected)) { cancel.click(); return; }
  if (!window.confirm('Remove this card? Choose Save to remove it for everyone, or Cancel to keep it.')) return;
  formInvalid = false;
  session.edit({ cards: session.draft.cards.filter((card) => card.id !== selected) });
});
reload.addEventListener('click', () => {
  if (reload.disabled || (session.dirty || formInvalid) && !window.confirm('Discard your unsaved changes and load the saved dashboard?')) return;
  const generation = editorGeneration;
  const previous = selected;
  void session.reload().then(() => {
    if (session.error || session.validationError || generation !== editorGeneration || selected !== previous) return;
    formInvalid = false;
    editor.remove();
    editorConfig = undefined;
    render();
  });
});
retry.addEventListener('click', () => { if (!formInvalid) void session.refresh(); });
const refresh = (): void => { if (!document.hidden && !disposed && !formInvalid) void session.refresh(); };
const beforeUnload = (event: BeforeUnloadEvent): void => {
  if (session.dirty || formInvalid || session.saving) { event.preventDefault(); event.returnValue = ''; }
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
  for (const view of views.values()) view.remove();
  views.clear();
  editor.remove();
});
window.addEventListener('pageshow', (event) => { if (event.persisted && disposed) window.location.reload(); });
render();
void session.refresh();
