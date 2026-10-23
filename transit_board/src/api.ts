import { fetchDepartures as bvgDepartures, searchStops as bvgStops, TransitApiError } from 'transit-board-core/src/api.ts';
import type { StopConfig as BvgStopConfig } from 'transit-board-core/src/types.ts';
import { searchEnturStops, fetchEnturDepartures } from './entur.ts';
import { searchSwissStops, fetchSwissDepartures } from './switzerland.ts';
import type { DepartureResult, ProviderId, StopChoice, StopConfig } from './types.ts';

export { TransitApiError };

export function searchStops(provider: ProviderId, query: string, signal?: AbortSignal): Promise<StopChoice[]> {
  switch (provider) {
    case 'bvg': return bvgStops(query, signal);
    case 'entur': return searchEnturStops(query, signal);
    case 'transport-ch': return searchSwissStops(query, signal);
    default: return Promise.reject(new TransitApiError('Choose a supported transit region.'));
  }
}

export async function fetchDepartures(provider: ProviderId, stop: StopConfig): Promise<DepartureResult> {
  if (provider === 'bvg') return bvgDepartures(stop as BvgStopConfig);
  let result: DepartureResult;
  switch (provider) {
    case 'entur': result = await fetchEnturDepartures(stop); break;
    case 'transport-ch': result = await fetchSwissDepartures(stop); break;
    default: throw new TransitApiError('Choose a supported transit region.');
  }
  const lines = stop.lines?.map((line) => line.trim().toLowerCase()).filter(Boolean);
  const destination = stop.destination?.trim().toLowerCase();
  return { ...result, departures: result.departures.filter((departure) =>
    (!stop.products || departure.product !== 'unknown' && stop.products.includes(departure.product)) &&
    (!lines?.length || lines.includes(departure.line.toLowerCase())) &&
    (!destination || departure.direction.toLowerCase().includes(destination))) };
}
