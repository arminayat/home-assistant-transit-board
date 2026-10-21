import { normalizeConfig } from "transit-board-core/src/config.ts";
import type { BoardConfig } from "transit-board-core/src/types.ts";

export type { BoardConfig } from "transit-board-core/src/types.ts";
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_STOPS = 20;

export function normalizeAppConfig(value: unknown): BoardConfig {
  const config = normalizeConfig(value);
  if (config.stops.length > MAX_STOPS) {
    throw new Error(`Choose no more than ${MAX_STOPS} stops for the shared board.`);
  }
  if (new TextEncoder().encode(JSON.stringify(config)).byteLength > MAX_BODY_BYTES) {
    throw new Error("The board configuration exceeds the 64 KiB size limit.");
  }
  return config;
}
