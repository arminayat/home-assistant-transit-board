import assert from 'node:assert/strict';
import { beforeEach, afterEach, test, mock } from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ stdin: {
  contents: "export * from './api.ts'; export {requestProviderJson,resetProviderHttpForTests} from './provider-http.ts';",
  resolveDir: new URL('../src/', import.meta.url).pathname, sourcefile: 'provider-test-entry.ts',
}, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24' });
const { searchStops, fetchDepartures, TransitApiError, requestProviderJson, resetProviderHttpForTests } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);

const planned = '2026-10-23T10:00:00+02:00';
const stop = { id: 'NSR:StopPlace:101', name: 'Example station' };
const call = (overrides = {}) => ({ realtime: false, aimedDepartureTime: planned,
  expectedDepartureTime: planned, actualDepartureTime: null, cancellation: false, forBoarding: true,
  destinationDisplay: { frontText: 'Example Centre' },
  quay: { id: 'NSR:Quay:201', name: 'Example boarding stop', publicCode: '2' },
  serviceJourney: { id: 'TST:ServiceJourney:101', line: { id: 'TST:Line:11', publicCode: '11', name: 'Example route', transportMode: 'tram' } },
  ...overrides });
const response = (value, init) => new Response(JSON.stringify(value), init);
const board = (calls) => response({ data: { stopPlace: { ...stop, estimatedCalls: calls } } });
const request = (provider = 'entur', path = '/example', init, signal) =>
  requestProviderJson(provider, `https://${provider === 'entur' ? 'api.entur.io' : 'transport.opendata.ch'}${path}`, init, signal);

beforeEach(() => resetProviderHttpForTests());
afterEach(() => { mock.restoreAll(); mock.timers.reset(); });

test('Entur searches the current v3 stop-place endpoint with public client identification', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({ type: 'FeatureCollection', features: [
    { properties: { id: stop.id, layer: 'stopPlace', names: { default: 'Example', display: 'Example, Oslo' } } },
    { properties: { id: stop.id, layer: 'stopPlace', names: { display: 'Example, Oslo' } } },
    { properties: { id: 'NSR:StopPlace:102', layer: 'stopPlace', names: { default: 'Example B' } } },
    { properties: { id: 'NSR:Quay:103', layer: 'stopPlace', names: { default: 'Not selectable' } } },
    { properties: { id: 'NSR:StopPlace:104', layer: 'address', names: { default: 'Not a stop' } } },
    null, { properties: {} },
  ] }));
  assert.deepEqual(await searchStops('entur', ' x '), []);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(await searchStops('entur', ' Example '), [
    { id: stop.id, name: 'Example, Oslo' }, { id: 'NSR:StopPlace:102', name: 'Example B' },
  ]);
  const [address, init] = fetchMock.mock.calls[0].arguments;
  const url = new URL(address);
  assert.equal(url.origin, 'https://api.entur.io');
  assert.equal(url.pathname, '/geocoder/v3/autocomplete');
  assert.deepEqual(Object.fromEntries(url.searchParams), { q: 'Example', lang: 'en', limit: '8', layers: 'stopPlace' });
  assert.equal(init.headers['ET-Client-Name'], 'arminayat-home-assistant-transit-board');
  assert.equal(init.credentials, 'omit');
});

test('Entur normalizes scheduled, actual, delayed and cancelled boarding calls honestly', async () => {
  mock.method(globalThis, 'fetch', async () => board([
    call(),
    call({ realtime: true, expectedDepartureTime: '2026-10-23T10:03:00+02:00' }),
    call({ realtime: true, actualDepartureTime: '2026-10-23T10:01:00+02:00', expectedDepartureTime: '2026-10-23T10:02:00+02:00' }),
    call({ realtime: true, cancellation: true, forBoarding: false }),
    call({ realtime: false, expectedDepartureTime: '2026-10-23T10:03:00+02:00' }),
    call({ realtime: true, expectedDepartureTime: null, quay: { id: 'NSR:Quay:202', name: 'Another quay', publicCode: null } }),
  ]));
  const { departures } = await fetchDepartures('entur', stop);
  assert.equal(departures.length, 6);
  assert.equal(departures[0].stopId, 'NSR:Quay:201');
  assert.equal(departures[0].stopName, 'Example boarding stop');
  assert.equal(departures[0].platform, '2');
  assert.equal(departures[0].realtime, false);
  assert.equal(departures[0].delayMinutes, null);
  assert.equal(departures[1].delayMinutes, 3);
  assert.equal(departures[1].realtime, true);
  assert.equal(departures[2].delayMinutes, 1, 'An actual time takes precedence over an estimate.');
  assert.equal(departures[3].cancelled, true);
  assert.equal(departures[3].when, Date.parse(planned));
  assert.equal(departures[3].delayMinutes, null);
  assert.equal(departures[4].when, Date.parse(planned));
  assert.equal(departures[4].realtime, false);
  assert.equal(departures[5].realtime, false);
  assert.equal(departures[5].platform, null);
  assert.notEqual(departures[0].key, departures[5].key);
});

test('Entur requests a bounded one-hour departure board using GraphQL variables', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([]));
  await fetchDepartures('entur', stop);
  const [address, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(address, 'https://api.entur.io/journey-planner/v3/graphql');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');
  const payload = JSON.parse(init.body);
  assert.deepEqual(payload.variables, { id: stop.id });
  assert.match(payload.query, /timeRange:\s*3600/);
  assert.match(payload.query, /numberOfDepartures:\s*100/);
  assert.equal(init.credentials, 'omit');
});

test('Entur rejects malformed envelopes and skips invalid rows and nonboarding calls', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([
    null, call({ aimedDepartureTime: '1' }), call({ aimedDepartureTime: '2026-10-23T10:00:00' }),
    call({ aimedDepartureTime: '2026-02-30T10:00:00Z' }),
    call({ quay: null }), call({ serviceJourney: {} }), call({ destinationDisplay: {} }),
    call({ forBoarding: false }), call({ realtime: true, expectedDepartureTime: 'not a date' }),
  ]));
  const result = await fetchDepartures('entur', stop);
  assert.equal(result.departures.length, 1);
  assert.equal(result.departures[0].realtime, false);
  for (const value of [{ errors: [{ message: 'Upstream failure' }] }, { data: { stopPlace: null } },
    { data: { stopPlace: { ...stop, estimatedCalls: {} } } }]) {
    resetProviderHttpForTests();
    fetchMock.mock.mockImplementation(async () => response(value));
    await assert.rejects(fetchDepartures('entur', stop), (error) => error instanceof TransitApiError);
  }
  resetProviderHttpForTests();
  fetchMock.mock.mockImplementation(async () => response({ features: {} }));
  await assert.rejects(searchStops('entur', 'Example'), /invalid station-search/);
});

test('Entur mode mapping covers rail, water, coach and cable transport', async () => {
  const modes = { rail: 'rail', metro: 'subway', tram: 'tram', bus: 'bus', coach: 'bus',
    trolleybus: 'bus', water: 'ferry', funicular: 'cableway', lift: 'cableway', cableway: 'cableway', future: 'unknown' };
  mock.method(globalThis, 'fetch', async () => board(Object.keys(modes).map((mode) => call({
    serviceJourney: { id: mode, line: { publicCode: mode, transportMode: mode } },
  }))));
  const { departures } = await fetchDepartures('entur', stop);
  assert.deepEqual(departures.map((item) => [item.line, item.product]), Object.entries(modes));
});

test('foreign filters are local, case-insensitive and separate from raw request sharing', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([
    call(), call({ destinationDisplay: { frontText: 'Example Park' } }),
    call({ serviceJourney: { id: 'bus', line: { publicCode: 'B20', transportMode: 'bus' } } }),
  ]));
  const tram = await fetchDepartures('entur', { ...stop, products: ['tram'], lines: [' 11 '], destination: 'cEnTrE' });
  assert.equal(tram.departures.length, 1);
  const bus = await fetchDepartures('entur', { ...stop, name: 'Renamed display', products: ['bus'], lines: ['b20'] });
  assert.equal(bus.departures[0].line, 'B20');
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal((await fetchDepartures('entur', { ...stop, destination: 'not present' })).departures.length, 0);
});

test('BVG remains a thin adapter preserving mode/direction/line behavior and cache', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({ departures: [
    { tripId: 'bvg-trip', stop: { id: '100001', name: 'Example bus stop' }, line: { name: '240', product: 'bus' },
      direction: 'Example station', plannedWhen: planned, when: planned, delay: null },
  ] }));
  const bvgStop = { id: '100001', name: 'Example', products: ['bus'], lines: ['240'], direction: { id: '100002', name: 'Example terminus' } };
  assert.equal((await fetchDepartures('bvg', bvgStop)).departures[0].line, '240');
  await fetchDepartures('bvg', bvgStop);
  const url = new URL(fetchMock.mock.calls[0].arguments[0]);
  assert.equal(url.origin, 'https://v6.bvg.transport.rest');
  assert.equal(url.searchParams.get('bus'), 'true');
  assert.equal(url.searchParams.get('subway'), 'false');
  assert.equal(url.searchParams.get('direction'), '100002');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('unknown providers are rejected before network access', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request'); });
  await assert.rejects(searchStops('unknown', 'Example'), /supported transit region/);
  await assert.rejects(fetchDepartures('unknown', stop), /supported transit region/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('HTTP shares identical in-flight requests and separates bodies and providers', async () => {
  let release;
  const fetchMock = mock.method(globalThis, 'fetch', () => new Promise((resolve) => { release = resolve; }));
  const first = request('entur', '/same', { method: 'POST', body: '{"id":"a"}' });
  const second = request('entur', '/same', { method: 'POST', body: '{"id":"a"}' });
  assert.equal(fetchMock.mock.callCount(), 1);
  release(response({ result: 'a' }));
  assert.deepEqual(await first, await second);
  fetchMock.mock.mockImplementation(async () => response({ result: 'next' }));
  await request('entur', '/same', { method: 'POST', body: '{"id":"b"}' });
  await request('transport-ch', '/same', { method: 'POST', body: '{"id":"a"}' });
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('cancelling one consumer leaves shared HTTP requests available to another', async () => {
  let release;
  const fetchMock = mock.method(globalThis, 'fetch', () => new Promise((resolve) => { release = resolve; }));
  const controller = new AbortController();
  const first = request('entur', '/shared', {}, controller.signal);
  const second = request('entur', '/shared');
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(fetchMock.mock.calls[0].arguments[1].signal.aborted, false);
  release(response({ result: true }));
  assert.equal((await second).data.result, true);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('already-aborted consumers make no HTTP request', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({}));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(request('entur', '/aborted', {}, controller.signal), { name: 'AbortError' });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('the cache expires after60seconds and is bounded to128entries', async () => {
  let now = 1_000_000;
  mock.method(Date, 'now', () => now);
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({ ok: true }));
  await request('entur', '/first');
  now += 59_999;
  await request('entur', '/first');
  assert.equal(fetchMock.mock.callCount(), 1);
  now += 1;
  await request('entur', '/first');
  assert.equal(fetchMock.mock.callCount(), 2);
  for (let index = 0; index < 128; index++) await request('entur', `/cached-${index}`);
  await request('entur', '/first');
  assert.equal(fetchMock.mock.callCount(), 131, 'The oldest record must be evicted after the cache bound.');
});

test('429 cooldown is shared within a provider and does not block the other provider', async () => {
  let now = Date.parse('2026-10-23T10:00:00Z');
  mock.method(Date, 'now', () => now);
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({}, { status: 429, headers: { 'Retry-After': '120' } }));
  await assert.rejects(request(), (error) => error.status === 429 && error.retryAfterMs === 120_000);
  now += 30_000;
  await assert.rejects(request('entur', '/another'), (error) => error.retryAfterMs === 90_000);
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.mockImplementation(async () => response({ ok: true }));
  await request('transport-ch');
  assert.equal(fetchMock.mock.callCount(), 2);
  now += 90_000;
  await request('entur');
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('Retry-After date and missing-header fallback work', async () => {
  const now = Date.parse('2026-10-23T10:00:00Z');
  mock.method(Date, 'now', () => now);
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({}, { status: 429,
    headers: { 'Retry-After': new Date(now + 45_000).toUTCString() } }));
  await assert.rejects(request(), (error) => error.retryAfterMs === 45_000);
  resetProviderHttpForTests();
  fetchMock.mock.mockImplementation(async () => response({}, { status: 429 }));
  await assert.rejects(request(), (error) => error.retryAfterMs === 60_000);
});

test('HTTP errors, invalid JSON and network failures do not poison subsequent attempts', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => response({}, { status: 503 }));
  await assert.rejects(request(), (error) => error.status === 503);
  fetchMock.mock.mockImplementation(async () => new Response('broken JSON'));
  await assert.rejects(request(), /invalid JSON/);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('Network unavailable'); });
  await assert.rejects(request(), /Could not reach/);
  fetchMock.mock.mockImplementation(async () => response({ ok: true }));
  assert.equal((await request()).data.ok, true);
  assert.equal(fetchMock.mock.callCount(), 4);
});

test('HTTP responses are bounded even with a missing Content-Length', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(8 * 1024 * 1024 + 1)));
  await assert.rejects(request(), /too large/);
  fetchMock.mock.mockImplementation(async () => response({ ok: true }));
  assert.equal((await request()).data.ok, true);
});

test('requests time out after15seconds and release their shared slot', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const fetchMock = mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const pending = request();
  mock.timers.tick(15_000);
  await assert.rejects(pending, /timed out/);
  fetchMock.mock.mockImplementation(async () => response({ ok: true }));
  assert.equal((await request()).data.ok, true);
});
