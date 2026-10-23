// Shared requests for App-owned providers; no persistent browser state.
import { TransitApiError } from 'transit-board-core/src/api.ts';
import type { ProviderId } from './types.ts';

type ForeignProvider = Exclude<ProviderId, 'bvg'>;
interface RequestOptions { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> }
interface JsonResult { data: unknown; updatedAt: number }
const CACHE_MS = 60_000;
const TIMEOUT_MS = 15_000;
const MAX_ENTRIES = 128;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TIMER_MS = 2_147_483_647;
const cache = new Map<string, JsonResult>();
const inFlight = new Map<string, Promise<JsonResult>>();
const cooldowns = new Map<ForeignProvider, number>();

function rateLimit(provider: ForeignProvider): TransitApiError {
  const remaining = Math.max(0, (cooldowns.get(provider) ?? 0) - Date.now());
  return new TransitApiError('This transit service is busy. Please try again later.', 429,
    Math.min(remaining, MAX_TIMER_MS));
}

function retryDelay(value: string | null): number {
  if (value !== null && value.trim()) {
    const seconds = Number(value);
    if (Number.isFinite(seconds * 1_000) && seconds >= 0) return seconds * 1_000;
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return CACHE_MS;
}

async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new TransitApiError('The transit service returned invalid JSON.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new TransitApiError('The transit service returned a response that is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new TransitApiError('The transit service returned invalid JSON.');
  }
}

async function perform(provider: ForeignProvider, url: string, init: RequestOptions): Promise<JsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json', ...init.headers } });
    if (!response.ok) {
      if (response.status === 429) {
        const until = Date.now() + retryDelay(response.headers.get('Retry-After'));
        cooldowns.set(provider, Math.max(cooldowns.get(provider) ?? 0, until));
        throw rateLimit(provider);
      }
      throw new TransitApiError(`The transit service returned HTTP ${response.status}.`, response.status);
    }
    const data = await readJson(response);
    const result = { data, updatedAt: Date.now() };
    cache.set(JSON.stringify([provider, url, init.method ?? 'GET', init.body ?? '']), result);
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new TransitApiError('The transit request timed out.');
    if (error instanceof TransitApiError) throw error;
    throw new TransitApiError('Could not reach the transit service.');
  } finally {
    clearTimeout(timeout);
  }
}

function observe<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function requestProviderJson(
  provider: ForeignProvider, url: string, init: RequestOptions = {}, signal?: AbortSignal,
): Promise<JsonResult> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const now = Date.now();
  for (const [key, value] of cache) if (now - value.updatedAt >= CACHE_MS) cache.delete(key);
  const key = JSON.stringify([provider, url, init.method ?? 'GET', init.body ?? '']);
  const saved = cache.get(key);
  if (saved) return observe(Promise.resolve(saved), signal);
  const pending = inFlight.get(key);
  if (pending) return observe(pending, signal);
  if ((cooldowns.get(provider) ?? 0) > now) return Promise.reject(rateLimit(provider));
  if (inFlight.size >= MAX_ENTRIES) return Promise.reject(new TransitApiError('Too many transit requests are pending. Please try again shortly.'));
  const request = perform(provider, url, init).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return observe(request, signal);
}

/** Reset isolated test fixtures without creating persistent or user-facing configuration. */
export function resetProviderHttpForTests(): void {
  cache.clear();
  inFlight.clear();
  cooldowns.clear();
}
