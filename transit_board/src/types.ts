// Adapted from the retained MIT transit-board-card types; see THIRD_PARTY_NOTICES.md.
import { PRODUCTS as BVG_PRODUCTS } from 'transit-board-core/src/types.ts';

export const PRODUCTS = [...BVG_PRODUCTS, 'rail', 'cableway'] as const;
export type Product = (typeof PRODUCTS)[number];
export type ProviderId = 'bvg' | 'entur' | 'transport-ch' | 'vag';

export interface StopChoice { id: string; name: string }
export interface StopConfig extends StopChoice {
  products?: Product[];
  lines?: string[];
  direction?: StopChoice;
  destination?: string;
}
export interface BoardConfig {
  type: 'custom:transit-board-card';
  provider: ProviderId;
  title?: string;
  stops: StopConfig[];
  max_departures: number;
}
export interface Departure {
  key: string;
  stopId: string;
  stopName: string;
  line: string;
  product: Product | 'unknown';
  direction: string;
  when: number;
  plannedWhen: number;
  delayMinutes: number | null;
  cancelled: boolean;
  platform: string | null;
  realtime: boolean;
}
export interface DepartureResult { departures: Departure[]; updatedAt: number }
