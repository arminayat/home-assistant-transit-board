import type { Product, ProviderId } from './types.ts';
export type { ProviderId } from './types.ts';

interface ProviderInfo {
  label: string;
  timeZone: string;
  timeLabel: string;
  products: readonly Product[];
  sourceLabel: string;
  sourceUrl: string;
}

export const PROVIDERS: Readonly<Record<ProviderId, ProviderInfo>> = {
  bvg: {
    label: 'Berlin & Brandenburg', timeZone: 'Europe/Berlin', timeLabel: 'Berlin',
    products: ['suburban', 'subway', 'tram', 'bus', 'ferry', 'regional', 'express'],
    sourceLabel: 'BVG REST API', sourceUrl: 'https://v6.bvg.transport.rest/',
  },
  entur: {
    label: 'Norway', timeZone: 'Europe/Oslo', timeLabel: 'Oslo',
    products: ['rail', 'subway', 'tram', 'bus', 'ferry', 'cableway'],
    sourceLabel: 'Entur', sourceUrl: 'https://developer.entur.no/docs/open-services',
  },
  'transport-ch': {
    label: 'Switzerland', timeZone: 'Europe/Zurich', timeLabel: 'Zürich',
    products: ['rail', 'tram', 'bus', 'ferry', 'cableway'],
    sourceLabel: 'Transport API · opentransportdata.swiss', sourceUrl: 'https://transport.opendata.ch/',
  },
  vag: {
    label: 'Nürnberg / VAG network', timeZone: 'Europe/Berlin', timeLabel: 'Nürnberg',
    products: ['suburban', 'subway', 'tram', 'bus'],
    sourceLabel: 'VAG Nürnberg · CC BY 4.0', sourceUrl: 'https://opendata.vag.de/dataset/api-echtzeitauskunft',
  },
};

export const PRODUCT_LABELS: Readonly<Record<Product, string>> = {
  suburban: 'S-Bahn', subway: 'Metro / U-Bahn', tram: 'Tram', bus: 'Bus', ferry: 'Ferry',
  regional: 'Regional train', express: 'Long-distance train', rail: 'Train', cableway: 'Cable car / funicular',
};

export function normalizeProvider(value: unknown): ProviderId {
  if (value === undefined) return 'bvg';
  if (typeof value !== 'string' || !Object.hasOwn(PROVIDERS, value)) {
    throw new Error('Choose a supported region from the Region list.');
  }
  return value as ProviderId;
}

export function isStationId(provider: ProviderId, id: unknown): id is string {
  return typeof id === 'string' && (provider === 'entur' ? /^NSR:StopPlace:\d{1,20}$/ : /^\d{1,20}$/).test(id);
}
