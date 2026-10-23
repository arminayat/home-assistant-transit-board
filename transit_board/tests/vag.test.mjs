import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ stdin: {
  contents: "export * from './vag.ts'; export * from './provider-http.ts';",
  resolveDir: new URL('../src/', import.meta.url).pathname,
}, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24' });
const { searchVagStops, fetchVagDepartures, resetProviderHttpForTests } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);

const planned = '2026-10-23T10:00:00+02:00';
const metadata = { Version: 'Puls-API-v1.3.0', Timestamp: planned };
const configured = { id: '510', name: 'Configured station' };
const station = { VGNKennung: 510, Haltestellenname: 'Nürnberg Hbf (Nürnberg)' };
const response = (value, init) => new Response(JSON.stringify(value), init);
const searchResponse = (rows) => response({ Metadata: metadata, Haltestellen: rows });
const departure = (overrides = {}) => ({
  Linienname: 'U1', Haltepunkt: 'HB:1', Richtungstext: 'Fürth Hardhöhe',
  AbfahrtszeitSoll: planned, AbfahrtszeitIst: planned, Produkt: 'UBahn',
  Fahrtnummer: 123, Betriebstag: '2026-10-23', Prognose: false, HaltesteigText: '1',
  ...overrides,
});
const board = (rows, overrides = {}) => response({ Metadata: metadata, ...station, Abfahrten: rows, ...overrides });

beforeEach(() => resetProviderHttpForTests());
afterEach(() => mock.restoreAll());

test('VAG searches only the requested name, deduplicates and bounds selectable station IDs', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => searchResponse([
    station, { ...station, Haltestellenname: 'Duplicate' },
    { VGNKennung: '511', Haltestellenname: ' Example ' },
    null, { VGNKennung: -1, Haltestellenname: 'Invalid' },
    { VGNKennung: Number.MAX_SAFE_INTEGER + 1, Haltestellenname: 'Invalid' },
    { VGNKennung: 'NSR:StopPlace:1', Haltestellenname: 'Foreign ID' },
    { VGNKennung: 512, Haltestellenname: '' },
    ...Array.from({ length: 12 }, (_, index) => ({ VGNKennung: 600 + index, Haltestellenname: `Stop ${index}` })),
  ]));
  assert.deepEqual(await searchVagStops(' x '), []);
  assert.equal(fetchMock.mock.callCount(), 0);
  const choices = await searchVagStops(' Nürnberg ');
  assert.equal(choices.length, 8);
  assert.deepEqual(choices.slice(0, 2), [{ id: '510', name: station.Haltestellenname }, { id: '511', name: 'Example' }]);
  const [address, init] = fetchMock.mock.calls[0].arguments;
  const url = new URL(address);
  assert.equal(url.origin, 'https://start.vag.de');
  assert.equal(url.pathname, '/dm/api/v1/haltestellen/VGN');
  assert.deepEqual([...url.searchParams], [['name', 'Nürnberg']]);
  assert.equal(init.credentials, 'omit');
  assert.equal(init.headers.Accept, 'application/json');
});

test('VAG accepts valid empty searches and rejects malformed metadata and arrays', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => searchResponse([]));
  assert.deepEqual(await searchVagStops('Example'), []);
  for (const value of [{ Message: 'Service error' }, { Metadata: metadata, Haltestellen: {} },
    { Metadata: { Version: 'v1', Timestamp: '2026-02-30T10:00:00Z' }, Haltestellen: [] },
    { Metadata: { Timestamp: planned }, Haltestellen: [] }, { Haltestellen: [] }]) {
    resetProviderHttpForTests();
    fetchMock.mock.mockImplementation(async () => response(value));
    await assert.rejects(searchVagStops('Example'), /invalid station-search/);
  }
});

test('VAG requests one bounded hour of departures and retains the actual boarding station', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([]));
  const result = await fetchVagDepartures({ ...configured, products: ['tram'], lines: ['5'], destination: 'Park' });
  assert.deepEqual(result.departures, []);
  assert.equal(typeof result.updatedAt, 'number');
  const [address, init] = fetchMock.mock.calls[0].arguments;
  const url = new URL(address);
  assert.equal(url.origin, 'https://start.vag.de');
  assert.equal(url.pathname, '/dm/api/v1/abfahrten/VGN/510');
  assert.deepEqual([...url.searchParams], [['timespan', '60'], ['limitcount', '100']]);
  assert.equal(init.credentials, 'omit');
});

test('only explicit Prognose with a valid Ist time enables realtime, including zero delay', async () => {
  mock.method(globalThis, 'fetch', async () => board([
    departure(), departure({ Prognose: true }),
    departure({ Prognose: true, AbfahrtszeitIst: '2026-10-23T10:03:00+02:00' }),
    departure({ Prognose: true, AbfahrtszeitIst: '2026-10-23T09:59:00+02:00' }),
    departure({ AbfahrtszeitIst: '2026-10-23T10:03:00+02:00' }),
    departure({ Prognose: true, AbfahrtszeitIst: null }),
    departure({ Prognose: 'true', AbfahrtszeitIst: '2026-10-23T10:03:00+02:00' }),
  ]));
  const { departures } = await fetchVagDepartures(configured);
  assert.equal(departures.length, 7);
  assert.deepEqual(departures.map((row) => [row.realtime, row.delayMinutes]), [
    [false, null], [true, 0], [true, 3], [true, -1], [false, null], [false, null], [false, null],
  ]);
  assert.equal(departures[0].stopId, '510');
  assert.equal(departures[0].stopName, station.Haltestellenname);
  assert.equal(departures[0].platform, '1');
  assert.equal(departures[0].when, Date.parse(planned));
  assert.ok(departures.every((row) => row.cancelled === false));
});

test('VAG maps documented modes and the verified live S-Bahn product while preserving unfamiliar modes', async () => {
  mock.method(globalThis, 'fetch', async () => board(['UBahn', 'Tram', 'Bus', 'SBahn', 'Future'].map((mode) =>
    departure({ Produkt: mode, Linienname: mode }))));
  const { departures } = await fetchVagDepartures(configured);
  assert.deepEqual(departures.map((row) => row.product), ['subway', 'tram', 'bus', 'suburban', 'unknown']);
});

test('invalid departure rows are skipped, malformed estimates stay scheduled and platforms remain optional', async () => {
  mock.method(globalThis, 'fetch', async () => board([
    null, departure({ AbfahrtszeitSoll: '1' }), departure({ AbfahrtszeitSoll: '2026-10-23T10:00:00' }),
    departure({ AbfahrtszeitSoll: '2026-02-30T10:00:00Z' }), departure({ Linienname: '' }),
    departure({ Richtungstext: null }), departure({ Fahrtnummer: 1.5 }),
    departure({ Prognose: true, AbfahrtszeitIst: '2026-02-30T10:00:00Z', HaltesteigText: null }),
    departure({ Fahrtnummer: '124', Haltepunkt: 'HB:2' }),
  ]));
  const { departures } = await fetchVagDepartures(configured);
  assert.equal(departures.length, 2);
  assert.equal(departures[0].realtime, false);
  assert.equal(departures[0].platform, null);
  assert.notEqual(departures[0].key, departures[1].key);
});

test('VAG rejects invalid requests before networking and mismatched or malformed station responses', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([]));
  await assert.rejects(fetchVagDepartures({ ...configured, id: '510/other' }), /valid VAG station/);
  assert.equal(fetchMock.mock.callCount(), 0);
  for (const value of [{ Metadata: metadata, ...station, Abfahrten: {} },
    { Metadata: metadata, VGNKennung: 511, Haltestellenname: 'Other', Abfahrten: [] },
    { Metadata: metadata, VGNKennung: 510, Abfahrten: [] },
    { Metadata: {}, ...station, Abfahrten: [] }, { Message: 'Service error' }]) {
    resetProviderHttpForTests();
    fetchMock.mock.mockImplementation(async () => response(value));
    await assert.rejects(fetchVagDepartures(configured), /invalid/);
  }
});

test('VAG applies the departure cap after invalid rows and preserves separate boarding events', async () => {
  mock.method(globalThis, 'fetch', async () => board([null, ...Array.from({ length: 105 }, (_, index) =>
    departure({ Fahrtnummer: index, Haltepunkt: `HB:${index}` }))]));
  const { departures } = await fetchVagDepartures(configured);
  assert.equal(departures.length, 100);
  assert.equal(new Set(departures.map((row) => row.key)).size, 100);
});

test('VAG uses shared cancellation and error handling without turning failures into empty boards', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => board([]));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(searchVagStops('Example', controller.signal), { name: 'AbortError' });
  assert.equal(fetchMock.mock.callCount(), 0);
  fetchMock.mock.mockImplementation(async () => response({ Message: 'Station does not exist' }, { status: 404 }));
  await assert.rejects(fetchVagDepartures(configured), (error) => error.status === 404);
});
