import { searchStops } from "./api.ts";
import { DEFAULT_CONFIG, normalizeConfig } from "./config.ts";
import { PRODUCTS } from "./types.ts";
import type { BoardConfig, Product, StopChoice, StopConfig } from "./types.ts";

const PRODUCT_NAMES: Record<Product, string> = {
  suburban: "S-Bahn", subway: "U-Bahn", tram: "Tram", bus: "Bus",
  ferry: "Ferry", regional: "Regional train", express: "Long-distance train",
};

const STYLE = `
  :host { display:block; color:var(--primary-text-color); }
  * { box-sizing:border-box; }
  [hidden] { display:none !important; }
  .editor { display:grid; gap:18px; padding:8px 0; }
  label { display:grid; gap:6px; }
  input:not([type=checkbox]), select { width:100%; padding:10px; font:inherit;
    border:1px solid var(--divider-color, #999); border-radius:6px;
    background:var(--card-background-color, #fff); color:inherit; }
  button { padding:8px 12px; font:inherit; cursor:pointer; }
  button:disabled { cursor:default; }
  fieldset { min-width:0; margin:0; padding:12px; border:1px solid var(--divider-color, #999); border-radius:6px; }
  legend { font-weight:600; }
  .stops, .stop, .search { display:grid; gap:12px; }
  .modes { display:flex; flex-wrap:wrap; gap:12px; }
  .modes label { display:flex; align-items:center; gap:5px; }
  .status, .hint { font-size:.9em; margin:0; }
  .hint { color:var(--secondary-text-color); }
  .direction { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  :focus-visible { outline:2px solid var(--primary-color, #1976d2); outline-offset:2px; }
`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function labeled<T extends HTMLInputElement | HTMLSelectElement>(name: string, input: T): HTMLLabelElement {
  const label = element("label", name);
  label.append(input);
  return label;
}

interface SearchControl {
  node: HTMLDivElement;
  dispose: () => void;
}

function stationSearch(name: string, action: string, onSelect: (choice: StopChoice) => void): SearchControl {
  const node = element("div");
  node.className = "search";
  const input = element("input");
  input.type = "search";
  input.placeholder = "Type at least 2 characters";
  input.autocomplete = "off";
  const results = element("select");
  results.hidden = true;
  const resultsLabel = labeled(`${name} results`, results);
  resultsLabel.hidden = true;
  const button = element("button", action);
  button.type = "button";
  button.disabled = true;
  const status = element("p");
  status.className = "status";
  status.setAttribute("role", "status");
  const inputLabel = labeled(name, input);
  node.append(inputLabel, resultsLabel, button, status);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let sequence = 0;
  let disposed = false;
  let choices: StopChoice[] = [];

  function cancel(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
    sequence += 1;
  }

  input.addEventListener("input", () => {
    cancel();
    const query = input.value.trim();
    choices = [];
    results.replaceChildren();
    resultsLabel.hidden = true;
    results.hidden = true;
    button.disabled = true;
    status.textContent = query.length < 2 ? "Type at least 2 characters to search." : "";
    if (query.length < 2 || disposed) return;
    const request = sequence;
    timer = setTimeout(async () => {
      timer = undefined;
      controller = new AbortController();
      status.textContent = "Searching…";
      try {
        const found = await searchStops(query, controller.signal);
        if (disposed || request !== sequence) return;
        choices = found;
        for (const choice of choices) {
          const option = element("option", choice.name);
          option.value = choice.id;
          results.append(option);
        }
        results.hidden = choices.length === 0;
        resultsLabel.hidden = choices.length === 0;
        button.disabled = choices.length === 0;
        status.textContent = choices.length === 0 ? "No stations found." : "";
      } catch (error) {
        if (disposed || request !== sequence) return;
        status.textContent = error instanceof Error ? error.message : "Station search failed. Try again.";
      }
    }, 350);
  });
  button.addEventListener("click", () => {
    const choice = choices.find((candidate) => candidate.id === results.value);
    if (choice && !disposed) onSelect({ ...choice });
  });
  return { node, dispose: () => { disposed = true; cancel(); } };
}

export class TransitBoardEditor extends HTMLElement {
  private config: BoardConfig = { ...DEFAULT_CONFIG, stops: [] };
  private rendered = false;
  private stationSearch?: SearchControl;
  private directionSearches: SearchControl[] = [];
  private stopsContainer?: HTMLDivElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(_value: unknown) { /* The standalone card does not require HA entities. */ }

  setConfig(value: unknown): void {
    const next = normalizeConfig(value);
    if (this.rendered && JSON.stringify(next) === JSON.stringify(this.config)) return;
    this.config = next;
    this.render();
  }

  connectedCallback(): void {
    if (!this.rendered) this.render();
  }

  disconnectedCallback(): void {
    this.disposeSearches();
    this.rendered = false;
  }

  private disposeSearches(): void {
    this.stationSearch?.dispose();
    this.directionSearches.forEach((search) => search.dispose());
    this.directionSearches = [];
  }

  private emit(next: BoardConfig): void {
    this.config = normalizeConfig(next);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: normalizeConfig(this.config) }, bubbles: true, composed: true,
    }));
  }

  private changeStop(index: number, update: (stop: StopConfig) => StopConfig): void {
    this.emit({ ...this.config, stops: this.config.stops.map((stop, i) => i === index ? update(stop) : stop) });
  }

  private render(): void {
    this.disposeSearches();
    const root = this.shadowRoot!;
    const style = element("style", STYLE);
    const wrapper = element("div");
    wrapper.className = "editor";
    const title = element("input");
    title.type = "text";
    title.value = this.config.title ?? "";
    title.addEventListener("input", () => {
      const { title: _oldTitle, ...rest } = this.config;
      this.emit(title.value.trim() ? { ...rest, title: title.value } : rest);
    });
    const maximum = element("input");
    maximum.type = "number";
    maximum.min = "1";
    maximum.max = "20";
    maximum.step = "1";
    maximum.value = String(this.config.max_departures);
    maximum.addEventListener("input", () => {
      const value = maximum.valueAsNumber;
      const valid = Number.isInteger(value) && value >= 1 && value <= 20;
      maximum.setAttribute("aria-invalid", String(!valid));
      if (valid) this.emit({ ...this.config, max_departures: value });
    });
    this.stationSearch = stationSearch("Search station", "Add stop", (stop) => {
      this.emit({ ...this.config, stops: [...this.config.stops, stop] });
      this.renderStops();
    });
    this.stopsContainer = element("div");
    this.stopsContainer.className = "stops";
    wrapper.append(labeled("Card title (optional)", title), labeled("Maximum departures", maximum),
      this.stationSearch.node, this.stopsContainer);
    root.replaceChildren(style, wrapper);
    this.rendered = true;
    this.renderStops();
  }

  private renderStops(): void {
    this.directionSearches.forEach((search) => search.dispose());
    this.directionSearches = [];
    const container = this.stopsContainer!;
    container.replaceChildren();
    if (this.config.stops.length === 0) container.append(element("p", "Add a station to configure your departure board."));
    this.config.stops.forEach((stop, index) => {
      const group = element("fieldset");
      group.className = "stop";
      group.append(element("legend", stop.name));
      const remove = element("button", `Remove ${stop.name}`);
      remove.type = "button";
      remove.addEventListener("click", () => {
        this.emit({ ...this.config, stops: this.config.stops.filter((_, i) => i !== index) });
        this.renderStops();
      });
      const modesGroup = element("fieldset");
      modesGroup.append(element("legend", "Transport modes"));
      const modes = element("div");
      modes.className = "modes";
      const modeStatus = element("p");
      modeStatus.className = "status";
      modeStatus.setAttribute("role", "status");
      for (const product of PRODUCTS) {
        const checkbox = element("input");
        checkbox.type = "checkbox";
        checkbox.checked = !stop.products || stop.products.includes(product);
        checkbox.addEventListener("change", () => {
          const current = this.config.stops[index].products ?? [...PRODUCTS];
          const selected = checkbox.checked ? [...current, product] : current.filter((item) => item !== product);
          if (selected.length === 0) {
            checkbox.checked = true;
            modeStatus.textContent = "Choose at least one transport mode.";
            return;
          }
          modeStatus.textContent = "";
          this.changeStop(index, (entry) => {
            const { products: _oldProducts, ...rest } = entry;
            return selected.length === PRODUCTS.length ? rest : { ...rest, products: selected };
          });
        });
        modes.append(labeled(PRODUCT_NAMES[product], checkbox));
      }
      modesGroup.append(modes, modeStatus);
      const lines = element("input");
      lines.type = "text";
      lines.placeholder = "For example: U5, 240";
      lines.value = stop.lines?.join(", ") ?? "";
      lines.addEventListener("input", () => {
        const selected = [...new Set(lines.value.split(",").map((line) => line.trim()).filter(Boolean))];
        this.changeStop(index, (entry) => {
          const { lines: _oldLines, ...rest } = entry;
          return selected.length ? { ...rest, lines: selected } : rest;
        });
      });
      const direction = element("div");
      direction.className = "direction";
      direction.append(element("span", stop.direction ? `Direction: ${stop.direction.name}` : "Direction: all"));
      if (stop.direction) {
        const clear = element("button", `Clear direction for ${stop.name}`);
        clear.type = "button";
        clear.addEventListener("click", () => {
          this.changeStop(index, (entry) => {
            const { direction: _oldDirection, ...rest } = entry;
            return rest;
          });
          this.renderStops();
        });
        direction.append(clear);
      }
      const search = stationSearch(`Direction for ${stop.name}`, "Set direction", (choice) => {
        this.changeStop(index, (entry) => ({ ...entry, direction: choice }));
        this.renderStops();
      });
      this.directionSearches.push(search);
      group.append(remove, modesGroup, labeled(`Lines for ${stop.name} (optional, comma separated)`, lines), direction, search.node);
      container.append(group);
    });
  }
}
