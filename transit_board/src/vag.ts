import { TransitApiError } from 'transit-board-core/src/api.ts';
import { isStationId } from './providers.ts';
import { requestProviderJson } from './provider-http.ts';
import type { Departure, DepartureResult, StopChoice, StopConfig } from './types.ts';

const BASE_URL = 'https://start.vag.de/dm/api/v1/';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function label(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function identifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  return typeof value === 'string' && /^\d{1,20}$/.test(value) ? value : null;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  const local = Date.parse(`${value.slice(0, 19)}Z`);
  return Number.isFinite(parsed) && Number.isFinite(local)
    && new Date(local).toISOString().slice(0, 19) === value.slice(0, 19) ? parsed : null;
}

function validEnvelope(value: unknown): value is Record<string, unknown> {
  return record(value) && record(value.Metadata) && label(value.Metadata.Version) !== null
    && timestamp(value.Metadata.Timestamp) !== null;
}

function station(value: unknown): StopChoice | null {
  if (!record(value)) return null;
  const id = identifier(value.VGNKennung);
  const name = label(value.Haltestellenname);
  return id && isStationId('vag', id) && name ? { id, name } : null;
}

function product(value: unknown): Departure['product'] {
  switch (label(value)?.toLowerCase()) {
    case 'ubahn': return 'subway';
    // Present in the current PULS v1.3 departure response at Nürnberg Hbf.
    case 'sbahn': return 'suburban';
    case 'tram': return 'tram';
    case 'bus': return 'bus';
    default: return 'unknown';
  }
}

function normalizeDeparture(value: unknown, stop: StopChoice): Departure | null {
  if (!record(value)) return null;
  const line = label(value.Linienname);
  const direction = label(value.Richtungstext);
  const plannedWhen = timestamp(value.AbfahrtszeitSoll);
  const tripId = identifier(value.Fahrtnummer);
  if (!line || !direction || plannedWhen === null || !tripId) return null;
  const predictedWhen = timestamp(value.AbfahrtszeitIst);
  // The API also sends Ist equal to Soll for scheduled journeys. Prognose is
  // the documented indication that actual/predicted data is available.
  const realtime = value.Prognose === true && predictedWhen !== null;
  const when = realtime ? predictedWhen! : plannedWhen;
  return {
    key: JSON.stringify(['vag', tripId, stop.id, label(value.Haltepunkt), plannedWhen, line, direction]),
    stopId: stop.id, stopName: stop.name, line, direction, product: product(value.Produkt),
    plannedWhen, when, realtime,
    delayMinutes: realtime ? Math.round((when - plannedWhen) / 60_000) : null,
    // PULS documents FaelltAus only on its separate trip API. The departure
    // monitor has no documented cancellation field; missing predictions do not imply one.
    cancelled: false,
    platform: label(value.HaltesteigText),
  };
}

export async function searchVagStops(query: string, signal?: AbortSignal): Promise<StopChoice[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL('haltestellen/VGN', BASE_URL);
  url.search = new URLSearchParams({ name: trimmed }).toString();
  const { data } = await requestProviderJson('vag', url.toString(), undefined, signal);
  if (!validEnvelope(data) || !Array.isArray(data.Haltestellen)) {
    throw new TransitApiError('VAG returned an invalid station-search response.');
  }
  const choices = new Map<string, StopChoice>();
  for (const value of data.Haltestellen) {
    const choice = station(value);
    if (choice && !choices.has(choice.id)) choices.set(choice.id, choice);
    if (choices.size === 8) break;
  }
  return [...choices.values()];
}

export async function fetchVagDepartures(stop: StopConfig): Promise<DepartureResult> {
  if (!isStationId('vag', stop.id)) throw new TransitApiError('Choose a valid VAG station.');
  const url = new URL(`abfahrten/VGN/${stop.id}`, BASE_URL);
  url.search = new URLSearchParams({ timespan: '60', limitcount: '100' }).toString();
  const { data, updatedAt } = await requestProviderJson('vag', url.toString());
  if (!validEnvelope(data) || !Array.isArray(data.Abfahrten)) {
    throw new TransitApiError('VAG returned an invalid departure response.');
  }
  const boarding = station(data);
  if (!boarding || boarding.id !== stop.id) throw new TransitApiError('VAG returned an invalid station.');
  const departures: Departure[] = [];
  for (const value of data.Abfahrten) {
    const departure = normalizeDeparture(value, boarding);
    if (departure) departures.push(departure);
    if (departures.length === 100) break;
  }
  return { departures, updatedAt };
}
