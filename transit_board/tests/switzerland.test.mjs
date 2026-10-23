import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { build } from "esbuild";

const compiled = await build({
  stdin: { contents: 'export * from "./src/switzerland.ts"; export * from "./src/provider-http.ts";',
    resolveDir: new URL("..", import.meta.url).pathname },
  bundle: true, write: false, platform: "node", format: "esm", target: "node22",
});
const { searchSwissStops, fetchSwissDepartures, resetProviderHttpForTests } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

const originalFetch = globalThis.fetch;
const configured = { id: "8503000", name: "Configured Zürich" };
const plannedWhen = Date.parse("2026-10-23T08:10:00+02:00");
const choice = { id: "8503000", name: "Zürich HB" };
const row = (overrides = {}, stopOverrides = {}) => ({
  stop: { station: choice, departure: "2026-10-23T08:10:00+0200",
    departureTimestamp: plannedWhen / 1_000, platform: "6", delay: null,
    prognosis: { platform: null, departure: null }, ...stopOverrides },
  name: "002615", category: "IR", categoryCode: null, number: "70", operator: "SBB", to: "Luzern",
  ...overrides,
});
let calls;
function respond(data) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  };
}
beforeEach(() => { calls = []; resetProviderHttpForTests(); });
afterEach(() => { globalThis.fetch = originalFetch; resetProviderHttpForTests(); });

test("Swiss station search uses the station endpoint and only offers valid persisted numeric IDs", async () => {
  respond({ stations: [choice, { ...choice, name: "Duplicate" },
    { id: "8500010", name: " Basel SBB " }, { id: "unknown", name: "Invalid" },
    { id: "1".repeat(21), name: "Oversized" }, { id: null, name: "Address" },
    { id: "1", name: "Refine", type: "refine" }, { id: "2", name: " " }, null] });
  assert.deepEqual(await searchSwissStops("  Zürich  "), [choice, { id: "8500010", name: "Basel SBB" }]);
  const { url, init } = calls[0];
  assert.equal(url.origin, "https://transport.opendata.ch");
  assert.equal(url.pathname, "/v1/locations");
  assert.equal(url.searchParams.get("query"), "Zürich");
  assert.equal(url.searchParams.get("type"), "station");
  assert.equal(init.credentials, "omit");
  assert.equal(calls.length, 1);
});

test("Swiss station search caps choices and performs no request for short or already cancelled searches", async () => {
  respond({ stations: Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `Station ${i}` })) });
  assert.deepEqual(await searchSwissStops(" z "), []);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchSwissStops("Zürich", controller.signal), { name: "AbortError" });
  assert.equal(calls.length, 0);
  assert.equal((await searchSwissStops("Zürich")).length, 8);
});

test("Swiss station search rejects a malformed top-level response while skipping malformed choices", async () => {
  respond({ stations: null });
  await assert.rejects(searchSwissStops("Zürich"), /invalid station response/);
});

test("Swiss departures preserve actual boarding identity, scheduled time and realtime prognosis", async () => {
  respond({ stationboard: [row({}, {
    station: { id: "8503001", name: "Actual boarding stop" },
    prognosis: { departure: "2026-10-23T08:13:00+0200", platform: "8" },
  })] });
  const result = await fetchSwissDepartures(configured);
  assert.ok(result.updatedAt > 0);
  assert.deepEqual({ ...result.departures[0], key: undefined }, {
    key: undefined, stopId: "8503001", stopName: "Actual boarding stop", line: "IR70", product: "rail",
    direction: "Luzern", plannedWhen, when: plannedWhen + 180_000, delayMinutes: 3,
    platform: "8", realtime: true, cancelled: false,
  });
});

test("Swiss scheduled-only rows do not claim realtime or cancellation from absent or invalid prognosis", async () => {
  respond({ stationboard: [row({ cancelled: true }, { delay: 3 }),
    row({ name: "second" }, { prognosis: { departure: "2026-10-23T08:13:00", platform: " " }, delay: 3 })] });
  const { departures } = await fetchSwissDepartures(configured);
  assert.equal(departures.length, 2);
  for (const departure of departures) {
    assert.equal(departure.when, plannedWhen);
    assert.equal(departure.realtime, false);
    assert.equal(departure.delayMinutes, null);
    assert.equal(departure.cancelled, false);
    assert.equal(departure.platform, "6");
  }
});

test("Swiss valid on-time and early prognosis are realtime, with explicit delay calculated from its timestamp", async () => {
  respond({ stationboard: [row({}, { prognosis: { departure: "2026-10-23T06:10:00Z" }, delay: 9 }),
    row({ name: "early" }, { prognosis: { departure: "2026-10-23T08:09:00+02:00" } })] });
  const { departures } = await fetchSwissDepartures(configured);
  assert.deepEqual(departures.map(({ realtime, delayMinutes }) => ({ realtime, delayMinutes })),
    [{ realtime: true, delayMinutes: 0 }, { realtime: true, delayMinutes: -1 }]);
});

test("Swiss planned time prefers valid Unix seconds and accepts an explicitly zoned scheduled fallback", async () => {
  respond({ stationboard: [row({}, { departure: "bad", departureTimestamp: plannedWhen / 1_000 }),
    row({ name: "fallback" }, { departureTimestamp: null, departure: "2026-10-23T08:10:00+0200" }),
    row({ name: "bad" }, { departureTimestamp: 9e30, departure: "2026-10-23T08:10:00" }),
    row({ name: "invalid-calendar" }, { departureTimestamp: null, departure: "2026-02-30T08:10:00+0100" })] });
  const { departures } = await fetchSwissDepartures(configured);
  assert.equal(departures.length, 2);
  assert.deepEqual(departures.map((departure) => departure.plannedWhen), [plannedWhen, plannedWhen]);
});

test("Swiss categories use documented category codes and common category names without guessing unknown modes", async () => {
  const byCode = [0, 1, 2, 3, 5, 8, 4, 6, 7, 9].map((categoryCode) => row({ categoryCode }));
  const byName = ["IC", "S", "Bus", "Tram", "BAT", "FUN", "unfamiliar"].map((category) => row({ category }));
  respond({ stationboard: [...byCode, ...byName] });
  const { departures } = await fetchSwissDepartures(configured);
  assert.deepEqual(departures.map((departure) => departure.product),
    ["rail", "rail", "rail", "rail", "rail", "rail", "ferry", "bus", "cableway", "tram",
      "rail", "rail", "bus", "tram", "ferry", "cableway", "unknown"]);
});

test("Swiss visible line uses category plus rail line number, and the public number for buses/trams", async () => {
  respond({ stationboard: [row(), row({ category: "S", number: "7" }),
    row({ category: "S", number: "S7" }), row({ category: "Bus", number: "31" }),
    row({ category: "T", number: "4" }), row({ category: null, number: null, name: "Local service" })] });
  assert.deepEqual((await fetchSwissDepartures(configured)).departures.map((departure) => departure.line),
    ["IR70", "S7", "S7", "31", "4", "Local service"]);
});

test("Swiss departure requests use public ID and documented upstream transportations, without local text filtering", async () => {
  respond({ stationboard: [row()] });
  const { departures } = await fetchSwissDepartures({ ...configured,
    products: ["rail", "tram", "bus", "ferry", "cableway"], lines: ["different"], destination: "different" });
  const { url } = calls[0];
  assert.equal(url.pathname, "/v1/stationboard");
  assert.equal(url.searchParams.get("id"), configured.id);
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("type"), "departure");
  assert.deepEqual(url.searchParams.getAll("transportations[]"), ["train", "tram", "bus", "ship", "cableway"]);
  assert.ok(url.searchParams.getAll("fields[]").includes("stationboard/stop"));
  assert.equal(departures.length, 1);
});

test("Swiss best-available keys keep journeys and boarding stops separate while ignoring prognosis updates", async () => {
  const main = row();
  const forecast = row({}, { prognosis: { departure: "2026-10-23T08:13:00+0200" } });
  respond({ stationboard: [main, forecast, row({ name: "different journey" }),
    row({ operator: "different operator" }), row({}, { station: { id: "8503001", name: "Other stop" } }),
    row({ name: null }), row({ name: null, to: "Other destination" })] });
  const departures = (await fetchSwissDepartures(configured)).departures;
  assert.equal(departures[0].key, departures[1].key);
  assert.equal(new Set(departures.map((departure) => departure.key)).size, 6);
  assert.ok(departures[0].key.includes("transport-ch"));
});

test("Swiss malformed rows are skipped and legitimate empty boards stay empty", async () => {
  respond({ stationboard: [null, [], {}, row({ stop: null }), row({ to: " " }),
    row({}, { station: { id: "invalid", name: "Bad stop" } }), row()] });
  assert.equal((await fetchSwissDepartures(configured)).departures.length, 1);
  resetProviderHttpForTests();
  respond({ stationboard: [] });
  assert.deepEqual((await fetchSwissDepartures(configured)).departures, []);
});

test("Swiss malformed top-level stationboards report a provider error", async () => {
  for (const invalid of [null, [], { stationboard: null }, { stationboard: {} }, { errors: ["Bad request"] }]) {
    resetProviderHttpForTests();
    respond(invalid);
    await assert.rejects(fetchSwissDepartures(configured), /invalid departure response/);
  }
});

test("Swiss response overshoot is capped after malformed rows are removed", async () => {
  respond({ stationboard: [null, {}, ...Array.from({ length: 105 }, (_, i) => row({ name: `journey-${i}` }))] });
  const { departures } = await fetchSwissDepartures(configured);
  assert.equal(departures.length, 100);
  assert.ok(departures[0].key.includes("journey-0"));
  assert.ok(departures[99].key.includes("journey-99"));
});
