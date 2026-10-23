import { TransitApiError } from 'transit-board-core/src/api.ts';
import { isStationId } from './providers.ts';
import { requestProviderJson } from './provider-http.ts';
import type { Departure, DepartureResult, Product, StopChoice, StopConfig } from './types.ts';

const BASE = 'https://api.entur.io';
// Public identification required by Entur; the repository name provides project contact.
const HEADERS = { 'ET-Client-Name': 'arminayat-home-assistant-transit-board' };
const QUERY = `query Board($id: String!) {
  stopPlace(id: $id) {
    id name
    estimatedCalls(timeRange: 3600, numberOfDepartures: 100) {
      realtime aimedDepartureTime expectedDepartureTime actualDepartureTime cancellation forBoarding
      destinationDisplay { frontText }
      quay { id name publicCode }
      serviceJourney { id line { id publicCode name transportMode } }
    }
  }
}`;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function label(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
  const time = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  const local = Date.parse(`${value.slice(0, 19)}Z`);
  return Number.isFinite(time) && Number.isFinite(local) &&
    new Date(local).toISOString().slice(0, 19) === value.slice(0, 19) ? time : null;
}

export async function searchEnturStops(query: string, signal?: AbortSignal): Promise<StopChoice[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const url = new URL('/geocoder/v3/autocomplete', BASE);
  url.search = new URLSearchParams({ q: text, lang: 'en', limit: '8', layers: 'stopPlace' }).toString();
  const { data } = await requestProviderJson('entur', url.toString(), { headers: HEADERS }, signal);
  if (!record(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new TransitApiError('Entur returned an invalid station-search response.');
  }
  const choices = new Map<string, StopChoice>();
  for (const feature of data.features) {
    if (!record(feature) || !record(feature.properties)) continue;
    const item = feature.properties;
    if (item.layer !== 'stopPlace' || !isStationId('entur', item.id) || !record(item.names)) continue;
    const name = label(item.names.display) ?? label(item.names.default);
    if (name) choices.set(item.id, { id: item.id, name });
  }
  return [...choices.values()];
}

function product(mode: unknown): Product | 'unknown' {
  switch (mode) {
    case 'rail': case 'monorail': return 'rail';
    case 'metro': return 'subway';
    case 'tram': return 'tram';
    case 'bus': case 'coach': case 'trolleybus': return 'bus';
    case 'water': return 'ferry';
    case 'funicular': case 'lift': case 'cableway': return 'cableway';
    default: return 'unknown';
  }
}

function normalize(value: unknown, stopName: string): Departure | null {
  if (!record(value) || !record(value.serviceJourney) || !record(value.serviceJourney.line) ||
      !record(value.quay) || !record(value.destinationDisplay)) return null;
  const tripId = label(value.serviceJourney.id);
  const stopId = label(value.quay.id);
  const line = label(value.serviceJourney.line.publicCode) ?? label(value.serviceJourney.line.name);
  const direction = label(value.destinationDisplay.frontText);
  const plannedWhen = timestamp(value.aimedDepartureTime);
  if (!tripId || !stopId || !line || !direction || plannedWhen === null) return null;
  const cancelled = value.cancellation === true;
  if (value.forBoarding === false && !cancelled) return null;
  const estimate = timestamp(value.actualDepartureTime) ?? timestamp(value.expectedDepartureTime);
  const realtime = !cancelled && value.realtime === true && estimate !== null;
  const when = realtime ? estimate! : plannedWhen;
  return {
    key: JSON.stringify(['entur', tripId, stopId, plannedWhen]),
    stopId, stopName: label(value.quay.name) ?? stopName,
    line, product: product(value.serviceJourney.line.transportMode), direction,
    when, plannedWhen,
    delayMinutes: realtime ? Math.round((when - plannedWhen) / 60_000) : null,
    cancelled, platform: label(value.quay.publicCode), realtime,
  };
}

export async function fetchEnturDepartures(stop: StopConfig): Promise<DepartureResult> {
  const result = await requestProviderJson('entur', `${BASE}/journey-planner/v3/graphql`, {
    method: 'POST', headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { id: stop.id } }),
  });
  const response = result.data;
  if (!record(response) || (Array.isArray(response.errors) && response.errors.length > 0) ||
      !record(response.data) || !record(response.data.stopPlace) ||
      !Array.isArray(response.data.stopPlace.estimatedCalls)) {
    throw new TransitApiError('Entur could not return departures for this station.');
  }
  const place = response.data.stopPlace;
  const name = label(place.name);
  if (!name || !isStationId('entur', place.id)) throw new TransitApiError('Entur returned an invalid station.');
  const departures: Departure[] = [];
  for (const call of place.estimatedCalls as unknown[]) {
    const departure = normalize(call, name);
    if (departure) departures.push(departure);
  }
  return { departures, updatedAt: result.updatedAt };
}
