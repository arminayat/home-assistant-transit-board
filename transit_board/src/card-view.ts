import type { TransitCardConfig } from './config.ts';

export type ConfigElement = HTMLElement & { setConfig(value: unknown): void };

export function iconButton(label: string, icon: 'add' | 'settings'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.setAttribute('aria-label', label);
  button.title = label;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icon === 'add' ? 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z' :
    'M19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.8-1L15 3h-4l-.4 3a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.4zM13 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z');
  svg.append(path);
  button.append(svg);
  return button;
}

/** Retains each card element and its polling lifecycle while other cards change. */
export class CardView {
  readonly node = document.createElement('article');
  readonly board = document.createElement('transit-board-card') as ConfigElement;
  readonly settings = iconButton('Card settings', 'settings');
  private toolbar = document.createElement('div');
  private signature = '';

  constructor(readonly id: string, open: (id: string) => void) {
    this.node.className = 'transit-card';
    this.node.dataset.cardId = id;
    this.toolbar.className = 'card-toolbar';
    this.toolbar.append(this.settings);
    this.node.append(this.toolbar, this.board);
    this.settings.setAttribute('aria-controls', 'settings-panel');
    this.settings.addEventListener('click', () => open(id));
  }

  update(config: TransitCardConfig, editing: boolean, removed: boolean, saving: boolean): void {
    const name = config.title || (config.stops.length === 1 ? config.stops[0].name : 'Departures');
    this.node.setAttribute('aria-label', name);
    this.settings.setAttribute('aria-label', `Settings for ${name}`);
    this.settings.title = `Settings for ${name}`;
    this.settings.setAttribute('aria-expanded', String(editing));
    this.settings.disabled = saving;
    this.toolbar.hidden = removed;
    if (removed) { this.board.remove(); return; }
    const signature = JSON.stringify(config);
    if (signature !== this.signature) { this.board.setConfig(config); this.signature = signature; }
    if (this.board.parentElement !== this.node) this.node.insertBefore(this.board, this.toolbar.nextSibling);
  }

  remove(): void { this.node.remove(); }
}
