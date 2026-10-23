/*! Adapted from arminayat/transit-board-card (MIT), commit
 * 8fec0c7f6058525a91ab31143a41b566fd078a0f. See THIRD_PARTY_NOTICES.md. */
import { BOARD_STYLES } from "../vendor/transit-board-card/src/styles.ts";
import type { BoardConfig, Departure } from "./types.ts";
import { PROVIDERS } from "./providers.ts";

export interface BoardView {
  config: BoardConfig;
  departures: Departure[];
  updating: boolean;
  loaded: boolean;
  errors: number;
  stale: boolean;
  updatedAt?: number;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function departureRow(departure: Departure, now: number, timeFormat: Intl.DateTimeFormat): HTMLTableRowElement {
  const row = element("tr");
  if (departure.cancelled) row.className = "cancelled";
  const line = element("td");
  line.append(element("span", departure.line, `badge ${departure.product}`));
  const destination = element("td");
  const status = departure.cancelled ? "cancelled"
    : !departure.realtime ? "scheduled"
    : departure.delayMinutes === null || departure.delayMinutes === 0 ? "on time"
    : departure.delayMinutes > 0 ? `+${departure.delayMinutes} min`
    : `${Math.abs(departure.delayMinutes)} min early`;
  const details = [timeFormat.format(departure.when), departure.stopName];
  if (departure.platform) details.push(`Platform ${departure.platform}`);
  details.push(status);
  destination.append(element("div", departure.direction, "destination"), element("div", details.join(" · "), "details"));
  const minutes = Math.ceil((departure.when - now) / 60_000);
  const due = departure.cancelled ? "—" : minutes <= 0 ? "now" : `${minutes}′`;
  const countdown = element("td", due, "due");
  countdown.setAttribute("aria-label", departure.cancelled ? "Cancelled" : minutes <= 0 ? "Departing now" : `In ${minutes} minutes`);
  row.append(line, destination, countdown);
  return row;
}

export function renderBoard(root: ShadowRoot, view: BoardView, now: number): void {
  const provider = PROVIDERS[view.config.provider];
  const timeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: provider.timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const title = view.config.title || (view.config.stops.length === 1 ? view.config.stops[0].name : "Departures");
  const style = element("style", `${BOARD_STYLES}
    .rail { background: #a12224; }
    .cableway { background: #51636f; }
    .source { margin: 8px 0 0; color: var(--secondary-text-color, #51636f); font-size: .75rem; line-height: 1.5; }
    .source a { color: inherit; text-underline-offset: 2px; }
  `);
  const card = document.createElement("ha-card");
  const board = element("section", undefined, "board");
  board.setAttribute("aria-label", title);
  const header = element("header");
  header.append(element("h2", title), element("span", provider.label, "heading-label"));
  board.append(header);
  if (view.departures.length) {
    const table = element("table");
    table.append(element("caption", "Upcoming departures"));
    const head = element("thead");
    const headings = element("tr");
    for (const text of ["Line", "Destination", "In"]) {
      const th = element("th", text);
      th.scope = "col";
      headings.append(th);
    }
    head.append(headings);
    const body = element("tbody");
    body.append(...view.departures.map((departure) => departureRow(departure, now, timeFormat)));
    table.append(head, body);
    board.append(table);
  } else {
    const message = !view.config.stops.length ? "Choose stations in the card editor to get started."
      : !view.loaded || view.updating ? "Loading departures…"
      : view.errors ? "Departures unavailable. Retrying automatically."
      : "No matching departures returned.";
    board.append(element("p", message, "empty"));
  }
  if (view.config.stops.length) {
    const message = view.errors
      ? view.stale ? "Some departures may be out of date. Retrying automatically."
        : "Some stops are unavailable. Retrying automatically."
      : view.updating ? "Updating departures…"
      : view.updatedAt !== undefined ? `Updated ${timeFormat.format(view.updatedAt)} · Times in ${provider.timeLabel}`
      : "Waiting for departures…";
    const status = element("p", message, `status${view.errors ? " warning" : ""}`);
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    board.append(status);
  }
  const source = element("p", undefined, "source");
  const link = element("a", provider.sourceLabel);
  link.href = provider.sourceUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  source.append(link);
  board.append(source);
  card.append(board);
  root.replaceChildren(style, card);
}
