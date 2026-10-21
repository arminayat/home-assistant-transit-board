import { PRODUCTS, type BoardConfig, type Product, type StopChoice, type StopConfig } from "./types.ts";

export const DEFAULT_CONFIG: BoardConfig = {
  type: "custom:transit-board-card", stops: [], max_departures: 5,
};

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function choice(value: unknown, field: string): StopChoice {
  const item = object(value, field);
  if (typeof item.id !== "string" || !/^\d{1,20}$/.test(item.id)) {
    throw new Error(`${field} needs a valid station ID. Use station search in the editor.`);
  }
  if (typeof item.name !== "string" || !item.name.trim()) {
    throw new Error(`${field} needs a station name.`);
  }
  return { id: item.id, name: item.name.trim() };
}

function stop(value: unknown): StopConfig {
  const item = object(value, "Stop");
  const result: StopConfig = choice(item, "Stop");
  if (item.direction !== undefined) result.direction = choice(item.direction, "Direction");
  if (item.products !== undefined) {
    if (!Array.isArray(item.products) || item.products.length === 0 ||
        item.products.some((p) => !PRODUCTS.includes(p as Product))) {
      throw new Error("Choose at least one valid transport mode for each stop.");
    }
    result.products = [...new Set(item.products)] as Product[];
  }
  if (item.lines !== undefined) {
    if (!Array.isArray(item.lines) || item.lines.some((line) => typeof line !== "string")) {
      throw new Error("Line filters must be a list of line names.");
    }
    const lines = [...new Set(item.lines.map((line: string) => line.trim().toUpperCase()).filter(Boolean))];
    if (lines.length) result.lines = lines;
  }
  return result;
}

export function normalizeConfig(value: unknown): BoardConfig {
  const input = object(value, "Card configuration");
  if (input.type !== undefined && input.type !== DEFAULT_CONFIG.type) {
    throw new Error(`Card type must be ${DEFAULT_CONFIG.type}.`);
  }
  if (input.stops !== undefined && !Array.isArray(input.stops)) {
    throw new Error("Stops must be a list. Use the visual editor to add stations.");
  }
  if (input.title !== undefined && typeof input.title !== "string") {
    throw new Error("Title must be text.");
  }
  const limit = input.max_departures ?? 5;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Maximum departures must be a whole number from 1 to 20.");
  }
  return {
    type: DEFAULT_CONFIG.type,
    ...(typeof input.title === "string" && input.title.trim() ? { title: input.title.trim() } : {}),
    stops: (input.stops as unknown[] | undefined ?? []).map(stop),
    max_departures: limit,
  };
}
