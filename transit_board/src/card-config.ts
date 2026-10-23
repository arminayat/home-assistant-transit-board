// Adapted from the retained MIT transit-board-card normalizer; see THIRD_PARTY_NOTICES.md.
import { isStationId, normalizeProvider, PROVIDERS } from './providers.ts';
import type { BoardConfig, Product, ProviderId, StopChoice, StopConfig } from './types.ts';

export const DEFAULT_CONFIG: BoardConfig = {
  type: 'custom:transit-board-card', provider: 'bvg', stops: [], max_departures: 5,
};

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function choice(value: unknown, field: string, provider: ProviderId): StopChoice {
  const item = object(value, field);
  if (!isStationId(provider, item.id)) {
    throw new Error(`${field} needs a valid station ID for ${PROVIDERS[provider].label}. Use station search in the editor.`);
  }
  if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`${field} needs a station name.`);
  return { id: item.id, name: item.name.trim() };
}

function stop(value: unknown, provider: ProviderId): StopConfig {
  const item = object(value, 'Stop');
  const result: StopConfig = choice(item, 'Stop', provider);
  if (item.direction !== undefined) {
    if (provider !== 'bvg') throw new Error('Use the destination text filter for Norway and Switzerland.');
    result.direction = choice(item.direction, 'Direction', provider);
  }
  if (item.destination !== undefined) {
    if (provider === 'bvg') throw new Error('Use station search to choose a direction for Berlin & Brandenburg.');
    if (typeof item.destination !== 'string' || item.destination.length > 200) {
      throw new Error('Destination filters must be text with no more than 200 characters.');
    }
    if (item.destination.trim()) result.destination = item.destination.trim();
  }
  if (item.products !== undefined) {
    if (!Array.isArray(item.products) || !item.products.length || item.products.some((product) =>
      !PROVIDERS[provider].products.includes(product as Product))) {
      throw new Error('Choose at least one valid transport mode for this region.');
    }
    result.products = [...new Set(item.products)] as Product[];
  }
  if (item.lines !== undefined) {
    if (!Array.isArray(item.lines) || item.lines.some((line) => typeof line !== 'string')) {
      throw new Error('Line filters must be a list of line names.');
    }
    const lines = [...new Set(item.lines.map((line: string) => line.trim().toUpperCase()).filter(Boolean))];
    if (lines.length) result.lines = lines;
  }
  return result;
}

export function normalizeConfig(value: unknown): BoardConfig {
  const input = object(value, 'Card configuration');
  const provider = normalizeProvider(input.provider);
  if (input.type !== undefined && input.type !== DEFAULT_CONFIG.type) throw new Error(`Card type must be ${DEFAULT_CONFIG.type}.`);
  if (input.stops !== undefined && !Array.isArray(input.stops)) throw new Error('Stops must be a list. Use the visual editor to add stations.');
  if (input.title !== undefined && typeof input.title !== 'string') throw new Error('Title must be text.');
  const limit = input.max_departures ?? 5;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('Maximum departures must be a whole number from 1 to 20.');
  }
  return {
    type: DEFAULT_CONFIG.type, provider,
    ...(typeof input.title === 'string' && input.title.trim() ? { title: input.title.trim() } : {}),
    stops: (input.stops as unknown[] | undefined ?? []).map((entry) => stop(entry, provider)),
    max_departures: limit,
  };
}
