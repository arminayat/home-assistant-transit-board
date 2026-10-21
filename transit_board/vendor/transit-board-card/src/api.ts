import { PRODUCTS } from "./types.ts";
import type { Departure, DepartureResult, StopChoice, StopConfig } from "./types.ts";

const BASE_URL = "https://v6.bvg.transport.rest";
const CACHE_MS = 60_000;
const TIMEOUT_MS = 15_000;
interface JsonResult { data: unknown; updatedAt: number }
const cache = new Map<string, JsonResult>();
const inFlight = new Map<string, Promise<JsonResult>>();
let cooldownUntil = 0;

export class TransitApiError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "TransitApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function label(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stopChoice(value: unknown): StopChoice | null {
  if (!isRecord(value)) return null;
  const id = label(value.id);
  const name = label(value.name);
  return id && name ? { id, name } : null;
}

function retryDelay(header: string | null): number {
  if (header !== null && header.trim() !== "") {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return CACHE_MS;
}

async function requestJson(url: string, kind: "locations" | "departures"): Promise<JsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      if (response.status === 429) {
        const delay = retryDelay(response.headers.get("Retry-After"));
        cooldownUntil = Math.max(cooldownUntil, Date.now() + delay);
        throw new TransitApiError("Transit service is busy. Please try again later.", 429,
          Math.max(0, cooldownUntil - Date.now()));
      }
      throw new TransitApiError(`Transit service returned HTTP ${response.status}.`, response.status);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) throw new TransitApiError("Transit request timed out.");
      throw new TransitApiError("Transit service returned invalid JSON.");
    }
    const valid = kind === "locations"
      ? Array.isArray(data)
      : isRecord(data) && Array.isArray(data.departures);
    if (!valid) throw new TransitApiError("Transit service returned an invalid response.");
    const result = { data, updatedAt: Date.now() };
    cache.set(url, result);
    return result;
  } catch (error) {
    if (error instanceof TransitApiError) throw error;
    if (controller.signal.aborted) throw new TransitApiError("Transit request timed out.");
    throw new TransitApiError("Could not reach the transit service.");
  } finally {
    clearTimeout(timeout);
  }
}

function getJson(url: string, kind: "locations" | "departures"): Promise<JsonResult> {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (now - value.updatedAt >= CACHE_MS) cache.delete(key);
  }
  const saved = cache.get(url);
  if (saved) return Promise.resolve(saved);
  const pending = inFlight.get(url);
  if (pending) return pending;
  if (cooldownUntil > now) {
    return Promise.reject(new TransitApiError("Transit service is busy. Please try again later.",
      429, cooldownUntil - now));
  }
  const request = requestJson(url, kind).finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}

// A cancelled consumer must not cancel a request shared with another card/editor.
function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function searchStops(query: string, signal?: AbortSignal): Promise<StopChoice[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = new URL("/locations", BASE_URL);
  url.search = new URLSearchParams({ query: trimmed, stops: "true", addresses: "false",
    poi: "false", results: "8" }).toString();
  const result = await withSignal(getJson(url.toString(), "locations"), signal);
  const choices = new Map<string, StopChoice>();
  for (const value of result.data as unknown[]) {
    if (!isRecord(value) || (value.type !== "stop" && value.type !== "station")) continue;
    const choice = stopChoice(value);
    // Search selections must also be valid persisted stop/direction configuration.
    if (choice && /^\d{1,20}$/.test(choice.id)) choices.set(choice.id, choice);
  }
  return [...choices.values()];
}

function normalizeDeparture(value: unknown): Departure | null {
  if (!isRecord(value) || !isRecord(value.line)) return null;
  const rawLine = value.line;
  const tripId = label(value.tripId);
  const stop = stopChoice(value.stop);
  const line = label(rawLine.name);
  const direction = label(value.direction);
  const plannedWhen = timestamp(value.plannedWhen);
  if (!tripId || !stop || !line || !direction || plannedWhen === null) return null;
  const actualWhen = timestamp(value.when);
  const cancelled = value.cancelled === true;
  const delay = typeof value.delay === "number" && Number.isFinite(value.delay) ? value.delay : null;
  const realtime = !cancelled && actualWhen !== null && (delay !== null || actualWhen !== plannedWhen);
  const product = PRODUCTS.find((item) => item === rawLine.product) ?? "unknown";
  return {
    key: JSON.stringify([tripId, stop.id, plannedWhen]),
    stopId: stop.id,
    stopName: stop.name,
    line,
    product,
    direction,
    when: cancelled ? plannedWhen : actualWhen ?? plannedWhen,
    plannedWhen,
    delayMinutes: realtime ? Math.round((delay ?? ((actualWhen! - plannedWhen) / 1_000)) / 60) : null,
    cancelled,
    platform: label(value.platform) ?? label(value.plannedPlatform),
    realtime,
  };
}

export async function fetchDepartures(stop: StopConfig): Promise<DepartureResult> {
  const url = new URL(`/stops/${encodeURIComponent(stop.id)}/departures`, BASE_URL);
  const params = new URLSearchParams({ duration: "60", results: "100", remarks: "false", language: "en" });
  for (const product of PRODUCTS) params.set(product, String(stop.products?.includes(product) ?? true));
  if (stop.direction) params.set("direction", stop.direction.id);
  url.search = params.toString();
  const result = await getJson(url.toString(), "departures");
  const rows = (result.data as { departures: unknown[] }).departures;
  const allowedLines = stop.lines?.map((line) => line.trim().toLowerCase()).filter(Boolean);
  const departures: Departure[] = [];
  for (const row of rows) {
    const departure = normalizeDeparture(row);
    if (departure && (!allowedLines?.length || allowedLines.includes(departure.line.toLowerCase()))) {
      departures.push(departure);
    }
  }
  return { departures, updatedAt: result.updatedAt };
}

/** Reset module-local state between isolated API tests. */
export function resetApiForTests(): void {
  cache.clear();
  inFlight.clear();
  cooldownUntil = 0;
}
