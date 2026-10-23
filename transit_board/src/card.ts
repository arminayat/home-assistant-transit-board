/*! Adapted from arminayat/transit-board-card (MIT), commit
 * 8fec0c7f6058525a91ab31143a41b566fd078a0f. See THIRD_PARTY_NOTICES.md. */
import { fetchDepartures, TransitApiError } from "./api.ts";
import { renderBoard } from "./board-view.ts";
import { DEFAULT_CONFIG, normalizeConfig } from "./card-config.ts";
import { mergeDepartures } from "./departures.ts";
import type { BoardConfig, DepartureResult } from "./types.ts";

const REFRESH_MS = 60_000;
const STALE_LIMIT_MS = 5 * 60_000;

export class TransitBoardCard extends HTMLElement {
  private config: BoardConfig = normalizeConfig(DEFAULT_CONFIG);
  private samples: (DepartureResult | undefined)[] = [];
  private errors = new Set<number>();
  private generation = 0;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private clockTimer?: ReturnType<typeof setInterval>;
  private updating = false;
  private loaded = false;
  private failures = 0;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("transit-board-card-editor");
  }

  static getStubConfig(): BoardConfig {
    return { ...DEFAULT_CONFIG, stops: [] };
  }

  // HA supplies state changes here. This card polls a public provider independently.
  set hass(_hass: unknown) {}

  setConfig(value: unknown): void {
    const config = normalizeConfig(value);
    if (JSON.stringify(config) === JSON.stringify(this.config)) {
      this.render();
      return;
    }
    this.pause();
    this.config = config;
    this.samples = [];
    this.errors.clear();
    this.failures = 0;
    this.loaded = false;
    this.render();
    this.resume();
  }

  connectedCallback(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    this.render();
    this.resume();
  }

  disconnectedCallback(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.pause();
  }

  getCardSize(): number {
    return Math.ceil((110 + this.config.max_departures * 62) / 50);
  }

  getGridOptions(): { columns: number; rows: string; min_columns: number } {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  private onVisibility = (): void => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  private canRun(): boolean {
    return this.isConnected && !document.hidden && this.config.stops.length > 0;
  }

  private pause(): void {
    this.generation += 1;
    clearTimeout(this.pollTimer);
    clearInterval(this.clockTimer);
    this.pollTimer = undefined;
    this.clockTimer = undefined;
    this.updating = false;
  }

  private resume(): void {
    if (!this.canRun() || this.updating) return;
    clearTimeout(this.pollTimer);
    clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => this.render(), 15_000);
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (!this.canRun() || this.updating) return;
    const generation = this.generation;
    this.updating = true;
    this.render();
    const results = await Promise.allSettled(this.config.stops.map((stop) => fetchDepartures(this.config.provider, stop)));
    if (generation !== this.generation || !this.canRun()) return;
    this.errors.clear();
    let retryAfter = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") this.samples[index] = result.value;
      else {
        this.errors.add(index);
        if (result.reason instanceof TransitApiError) {
          retryAfter = Math.max(retryAfter, result.reason.retryAfterMs ?? 0);
        }
      }
    });
    this.failures = this.errors.size ? this.failures + 1 : 0;
    this.updating = false;
    this.loaded = true;
    this.render();
    const backoff = Math.min(5 * REFRESH_MS, REFRESH_MS * 2 ** Math.min(Math.max(this.failures - 1, 0), 3));
    this.pollTimer = setTimeout(() => void this.refresh(), Math.max(backoff, retryAfter));
  }

  private render(): void {
    if (!this.shadowRoot) return;
    const now = Date.now();
    const retained = this.samples.filter((sample): sample is DepartureResult =>
      sample !== undefined && now - sample.updatedAt < STALE_LIMIT_MS);
    const updatedAt = retained.length ? Math.min(...retained.map((sample) => sample.updatedAt)) : undefined;
    renderBoard(this.shadowRoot, {
      config: this.config,
      departures: mergeDepartures(retained.flatMap((sample) => sample.departures), this.config.max_departures, now),
      updating: this.updating,
      loaded: this.loaded,
      errors: this.errors.size,
      stale: [...this.errors].some((index) => this.samples[index] !== undefined),
      updatedAt,
    }, now);
  }
}
