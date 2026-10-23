import { normalizeConfig } from "./card-config.ts";
import type { BoardConfig } from "./types.ts";

export type { BoardConfig } from "./types.ts";
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_STOPS = 20;
export const MAX_CARDS = 20;

export type TransitCardConfig = BoardConfig & { id: string };
export interface AppConfig { cards: TransitCardConfig[] }
export const DEFAULT_APP_CONFIG: AppConfig = { cards: [] };

export function normalizeAppConfig(value: unknown): AppConfig {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("cards" in value) || !Array.isArray(value.cards)) {
    throw new Error("Reload the Transit Board App before saving. Settings must contain a cards list; this App no longer accepts a single-card configuration.");
  }
  if (value.cards.length > MAX_CARDS) throw new Error(`Choose no more than ${MAX_CARDS} cards.`);
  const ids = new Set<string>();
  let stopCount = 0;
  const cards = value.cards.map((item: unknown): TransitCardConfig => {
    if (!item || typeof item !== "object" || Array.isArray(item) || !("id" in item) ||
        typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(item.id)) {
      throw new Error("Each card needs a valid ID. Reload the App and add the card again.");
    }
    if (ids.has(item.id)) throw new Error("Each card must have a unique ID.");
    ids.add(item.id);
    const normalized = normalizeConfig(item);
    stopCount += normalized.stops.length;
    if (stopCount > MAX_STOPS) throw new Error(`Choose no more than ${MAX_STOPS} stops across all cards.`);
    return { id: item.id, ...normalized };
  });
  const config = { cards };
  if (new TextEncoder().encode(JSON.stringify(config)).byteLength > MAX_BODY_BYTES) {
    throw new RangeError("The board configuration exceeds the 64 KiB size limit.");
  }
  return config;
}

/** Disk compatibility only. API writes must always use the current collection shape. */
export function migrateSavedConfig(value: unknown): AppConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("cards" in value) return normalizeAppConfig(value);
    if ("type" in value && value.type === "custom:transit-board-card" &&
        "stops" in value && Array.isArray(value.stops) && "max_departures" in value &&
        typeof value.max_departures === "number") {
      try {
        return normalizeAppConfig({ cards: [{ id: "legacy", ...normalizeConfig(value) }] });
      } catch (error) {
        if (error instanceof RangeError) {
          throw new RangeError("The single-card configuration exceeds the 64 KiB migration limit. Use the previous App version to reduce its settings, or restore a smaller backup, before updating again.");
        }
        throw error;
      }
    }
  }
  throw new Error("The saved configuration is not a valid Transit Board configuration.");
}
