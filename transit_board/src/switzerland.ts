import { TransitApiError } from "transit-board-core/src/api.ts";
import { requestProviderJson } from "./provider-http.ts";
import type { Departure, DepartureResult, Product, StopChoice, StopConfig } from "./types.ts";

const BASE_URL = "https://transport.opendata.ch/v1/";
const TRANSPORTATIONS: Partial<Record<Product, string>> = {
  rail: "train", tram: "tram", bus: "bus", ferry: "ship", cableway: "cableway",
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function label(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function station(value: unknown): StopChoice | null {
  if (!record(value)) return null;
  const id = label(value.id);
  const name = label(value.name);
  return id && /^\d{1,20}$/.test(id) && name ? { id, name } : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
  // The live API also emits +0200; normalize it for native ISO parsing.
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(normalized);
  const local = Date.parse(`${value.slice(0, 19)}Z`);
  if (!Number.isFinite(parsed) || !Number.isFinite(local)
    || new Date(local).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return parsed;
}

function scheduledTime(stop: Record<string, unknown>): number | null {
  const seconds = stop.departureTimestamp;
  if (typeof seconds === "number" && Number.isSafeInteger(seconds)
    && Math.abs(seconds) <= 8_640_000_000_000) return seconds * 1_000;
  return timestamp(stop.departure);
}

function productFor(row: Record<string, unknown>): Departure["product"] {
  // The provider's StationBoardJourney source documents these internal codes.
  const code = row.categoryCode;
  if (typeof code === "number") {
    if ([0, 1, 2, 3, 5, 8].includes(code)) return "rail";
    if (code === 4) return "ferry";
    if (code === 6) return "bus";
    if (code === 7) return "cableway";
    if (code === 9) return "tram";
  }
  // Current responses often have no code. Preserve unfamiliar categories as unknown.
  const category = label(row.category)?.toUpperCase() ?? "";
  if (/^(?:TRAIN|S|SN|R|RE|IR|IC|ICN|EC|ICE|TGV|RJ|RJX|EN|NJ|IRE|RB|TER)$/.test(category)) return "rail";
  if (/^(?:BUS|B|NFB|CAR)$/.test(category)) return "bus";
  if (/^(?:TRAM|T|NFT)$/.test(category)) return "tram";
  if (/^(?:SHIP|BAT|BATEAU|FERRY)$/.test(category)) return "ferry";
  if (/^(?:CABLEWAY|FUN|GB|PB|SL|ASC)$/.test(category)) return "cableway";
  return "unknown";
}

function normalizeDeparture(value: unknown): Departure | null {
  if (!record(value) || !record(value.stop)) return null;
  const stop = value.stop;
  const boarding = station(stop.station);
  const plannedWhen = scheduledTime(stop);
  const direction = label(value.to);
  const category = label(value.category);
  const number = label(value.number);
  const name = label(value.name);
  const product = productFor(value);
  const line = product === "rail" && category && number
    ? number.toUpperCase().startsWith(category.toUpperCase()) ? number : `${category}${number}`
    : number ?? name ?? category;
  if (!boarding || plannedWhen === null || !direction || !line) return null;
  const prognosis = record(stop.prognosis) ? stop.prognosis : {};
  const predictedWhen = timestamp(prognosis.departure);
  const realtime = predictedWhen !== null;
  return {
    // v1 has no documented trip ID. Its journey name, operator and boarding event
    // form the best available identity; line/destination cover nameless journeys.
    key: JSON.stringify(["transport-ch", name, label(value.operator), boarding.id, plannedWhen, line, direction]),
    stopId: boarding.id,
    stopName: boarding.name,
    line,
    product,
    direction,
    plannedWhen,
    when: predictedWhen ?? plannedWhen,
    delayMinutes: realtime ? Math.round((predictedWhen - plannedWhen) / 60_000) : null,
    // v1 does not document cancellation status. Never infer it from missing prognosis.
    cancelled: false,
    platform: label(prognosis.platform) ?? label(stop.platform),
    realtime,
  };
}

export async function searchSwissStops(query: string, signal?: AbortSignal): Promise<StopChoice[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = new URL("locations", BASE_URL);
  url.search = new URLSearchParams({ query: trimmed, type: "station" }).toString();
  const { data } = await requestProviderJson("transport-ch", url.toString(), undefined, signal);
  if (!record(data) || !Array.isArray(data.stations)) {
    throw new TransitApiError("Swiss transit service returned an invalid station response.");
  }
  const choices = new Map<string, StopChoice>();
  for (const value of data.stations) {
    if (record(value) && value.type !== undefined && value.type !== "station") continue;
    const choice = station(value);
    if (choice && !choices.has(choice.id)) choices.set(choice.id, choice);
  }
  return [...choices.values()].slice(0, 8);
}

export async function fetchSwissDepartures(stop: StopConfig): Promise<DepartureResult> {
  const url = new URL("stationboard", BASE_URL);
  const params = new URLSearchParams({ id: stop.id, limit: "100", type: "departure" });
  for (const product of stop.products ?? []) {
    const transportation = TRANSPORTATIONS[product];
    if (transportation) params.append("transportations[]", transportation);
  }
  // Exclude passList: it can multiply a departure-board response many times over.
  for (const field of ["stop", "name", "category", "categoryCode", "number", "operator", "to"]) {
    params.append("fields[]", `stationboard/${field}`);
  }
  url.search = params.toString();
  const { data, updatedAt } = await requestProviderJson("transport-ch", url.toString());
  if (!record(data) || !Array.isArray(data.stationboard)) {
    throw new TransitApiError("Swiss transit service returned an invalid departure response.");
  }
  const departures = data.stationboard.map(normalizeDeparture)
    .filter((departure): departure is Departure => departure !== null).slice(0, 100);
  return { departures, updatedAt };
}
