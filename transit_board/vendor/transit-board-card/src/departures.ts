import type { Departure } from "./types.ts";

/** Merge repeated board results while preserving each actual boarding stop. */
export function mergeDepartures(
  departures: readonly Departure[], limit: number, now = Date.now(),
): Departure[] {
  const unique = new Map<string, Departure>();
  for (const departure of departures) {
    const when = departure.cancelled ? departure.plannedWhen : departure.when;
    if (!Number.isFinite(when) || when < now - 60_000) continue;
    const previous = unique.get(departure.key);
    // A cancellation or realtime record is more useful than its scheduled copy.
    if (!previous || (departure.cancelled && !previous.cancelled)
      || (!previous.cancelled && departure.realtime && !previous.realtime)) {
      unique.set(departure.key, departure);
    }
  }
  return [...unique.values()].sort((a, b) => {
    const left = a.cancelled ? a.plannedWhen : a.when;
    const right = b.cancelled ? b.plannedWhen : b.when;
    return left - right || a.plannedWhen - b.plannedWhen || a.key.localeCompare(b.key);
  }).slice(0, Math.max(0, Math.floor(limit)));
}
