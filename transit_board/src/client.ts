import { normalizeAppConfig } from './config.ts';
import type { BoardConfig } from 'transit-board-core/src/types.ts';

export interface Snapshot { config: BoardConfig; etag: string }

export class ConflictError extends Error {
  constructor() { super('Someone else saved changes. Your draft is kept. Reload the saved board before editing again.'); }
}

async function request(init?: RequestInit): Promise<Snapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch('api/config', { ...init, credentials: 'same-origin',
      cache: 'no-store', signal: controller.signal });
    if (response.status === 412) throw new ConflictError();
    if (response.status === 401 || response.status === 403) {
      throw new Error('Home Assistant access expired or was denied. Reopen Transit Board from the sidebar.');
    }
    const body: unknown = await response.json();
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error : 'Could not load or save settings. Try again.';
      throw new Error(message);
    }
    const etag = response.headers.get('etag');
    if (!etag) throw new Error('The server returned settings without a revision. Reopen the App.');
    return { config: normalizeAppConfig(body), etag };
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The settings request timed out. Your changes are kept; try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function loadConfig(): Promise<Snapshot> { return request(); }

export function saveConfig(config: BoardConfig, etag: string): Promise<Snapshot> {
  return request({ method: 'PUT', headers: { 'Content-Type': 'application/json',
    'X-Transit-Board': '1', 'If-Match': etag }, body: JSON.stringify(normalizeAppConfig(config)) });
}
