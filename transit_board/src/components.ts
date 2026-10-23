import { TransitBoardCard } from './card.ts';
import { TransitBoardEditor } from './editor.ts';

if (!customElements.get('transit-board-card-editor')) {
  customElements.define('transit-board-card-editor', TransitBoardEditor);
}
if (!customElements.get('transit-board-card')) {
  customElements.define('transit-board-card', TransitBoardCard);
}
