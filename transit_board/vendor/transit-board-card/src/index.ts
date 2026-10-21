import { TransitBoardCard } from "./card.ts";
import { TransitBoardEditor } from "./editor.ts";

if (!customElements.get("transit-board-card-editor")) {
  customElements.define("transit-board-card-editor", TransitBoardEditor);
}
if (!customElements.get("transit-board-card")) {
  customElements.define("transit-board-card", TransitBoardCard);
}

type CardWindow = Window & {
  customCards?: { type: string; name: string; description: string; preview: boolean; documentationURL: string }[];
};
const cardWindow = window as CardWindow;
cardWindow.customCards ??= [];
if (!cardWindow.customCards.some((card) => card.type === "transit-board-card")) {
  cardWindow.customCards.push({
    type: "transit-board-card",
    name: "Transit Board",
    description: "Live Berlin and Brandenburg departures. Choose stops, lines and directions in the visual editor.",
    preview: true,
    documentationURL: "https://github.com/arminayat/transit-board-card",
  });
}
