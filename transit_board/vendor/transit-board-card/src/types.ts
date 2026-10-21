export const PRODUCTS = [
  "suburban", "subway", "tram", "bus", "ferry", "regional", "express",
] as const;

export type Product = (typeof PRODUCTS)[number];

export interface StopChoice {
  id: string;
  name: string;
}

export interface StopConfig extends StopChoice {
  products?: Product[];
  lines?: string[];
  direction?: StopChoice;
}

export interface BoardConfig {
  type: "custom:transit-board-card";
  title?: string;
  stops: StopConfig[];
  max_departures: number;
}

export interface Departure {
  key: string;
  stopId: string;
  stopName: string;
  line: string;
  product: Product | "unknown";
  direction: string;
  when: number;
  plannedWhen: number;
  delayMinutes: number | null;
  cancelled: boolean;
  platform: string | null;
  realtime: boolean;
}

export interface DepartureResult {
  departures: Departure[];
  updatedAt: number;
}
