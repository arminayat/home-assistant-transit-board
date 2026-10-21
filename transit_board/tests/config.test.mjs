import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [new URL("../src/config.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", target: "node24",
});
const { DEFAULT_APP_CONFIG, MAX_BODY_BYTES, MAX_CARDS, MAX_STOPS, normalizeAppConfig, migrateSavedConfig } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);
const board = { type: "custom:transit-board-card", stops: [], max_departures: 5 };
const stop = { id: "100001", name: "Example station" };
const card = (id, overrides = {}) => ({ id, ...board, ...overrides });

test("the default is an empty collection, and old API shapes are rejected", () => {
  assert.deepEqual(DEFAULT_APP_CONFIG, { cards: [] });
  assert.deepEqual(normalizeAppConfig({ cards: [] }), { cards: [] });
  for (const value of [undefined, null, [], {}, board, { cards: null }, { cards: {} }]) {
    assert.throws(() => normalizeAppConfig(value), /Reload the Transit Board App/);
  }
});

test("normalizes each independently identified card without merging repeated station selections", () => {
  const input = { cards: [
    card("bus-board", { title: " Bus ", stops: [{ ...stop, products: ["bus"], lines: [" 240 ", "240"] }] }),
    card("rail_board", { title: "Rail", stops: [{ ...stop, products: ["subway"], lines: [" u5 "] }], max_departures: 8 }),
  ] };
  const normalized = normalizeAppConfig(input);
  assert.equal(normalized.cards.length, 2);
  assert.equal(normalized.cards[0].title, "Bus");
  assert.deepEqual(normalized.cards[0].stops[0].lines, ["240"]);
  assert.deepEqual(normalized.cards[1].stops[0].lines, ["U5"]);
  assert.equal(normalized.cards[1].max_departures, 8);
  normalized.cards[0].stops[0].lines.push("N40");
  assert.deepEqual(input.cards[0].stops[0].lines, [" 240 ", "240"]);
  assert.deepEqual(normalized.cards[1].stops[0].lines, ["U5"]);
});

test("requires safe unique card IDs", () => {
  for (const id of ["", "has space", "path/name", ".", "a".repeat(65), 123, undefined]) {
    assert.throws(() => normalizeAppConfig({ cards: [card(id)] }), /valid ID/);
  }
  assert.throws(() => normalizeAppConfig({ cards: [card("same"), card("same")] }), /unique ID/);
  assert.equal(normalizeAppConfig({ cards: [card("A_z-19"), card("a".repeat(64))] }).cards.length, 2);
});

test("bounds card count and aggregate stops rather than stations per card", () => {
  assert.equal(MAX_CARDS, 20);
  assert.equal(MAX_STOPS, 20);
  assert.equal(normalizeAppConfig({ cards: Array.from({ length: MAX_CARDS }, (_, i) => card(String(i))) }).cards.length, MAX_CARDS);
  assert.throws(() => normalizeAppConfig({ cards: Array.from({ length: MAX_CARDS + 1 }, (_, i) => card(String(i))) }), /20 cards/);
  const stops = (count) => Array.from({ length: count }, () => ({ ...stop }));
  assert.equal(normalizeAppConfig({ cards: [card("a", { stops: stops(10) }), card("b", { stops: stops(10) })] }).cards.length, 2);
  assert.throws(() => normalizeAppConfig({ cards: [card("a", { stops: stops(10) }), card("b", { stops: stops(11) })] }), /20 stops across all cards/);
});

test("enforces the serialized UTF-8 bound and upstream settings validation", () => {
  assert.equal(MAX_BODY_BYTES, 65_536);
  assert.throws(() => normalizeAppConfig({ cards: [card("a", { title: "雪".repeat(25_000) })] }), /64 KiB/);
  assert.throws(() => normalizeAppConfig({ cards: [card("a", { max_departures: 0 })] }), /Maximum departures/);
  assert.throws(() => normalizeAppConfig({ cards: [card("a", { stops: [{ ...stop, products: [] }] })] }), /transport mode/);
});

test("migrates complete legacy settings deterministically only through the disk reader", () => {
  const legacy = { ...board, title: "Custom board", max_departures: 9,
    stops: [{ ...stop, products: ["bus"], lines: ["240"], direction: { id: "100002", name: "Example terminus" } }] };
  const expected = { cards: [{ id: "legacy", ...legacy }] };
  assert.deepEqual(migrateSavedConfig(legacy), expected);
  assert.deepEqual(migrateSavedConfig(legacy), expected);
  assert.deepEqual(migrateSavedConfig(expected), expected);
  assert.throws(() => normalizeAppConfig(legacy), /Reload/);
});

test("rejects malformed saved legacy and collection data", () => {
  for (const value of [{}, { title: "Unknown object" }, { ...board, max_departures: null },
    { ...board, stops: null }, { ...board, cards: null }, { cards: [card("dup"), card("dup")] }]) {
    assert.throws(() => migrateSavedConfig(value));
  }
});

test("a legacy document that outgrows the migration limit has explicit recovery guidance", () => {
  const overhead = Buffer.byteLength(JSON.stringify({ ...board, title: "" }));
  const legacy = { ...board, title: "x".repeat(MAX_BODY_BYTES - overhead) };
  assert.equal(Buffer.byteLength(JSON.stringify(legacy)), MAX_BODY_BYTES);
  assert.throws(() => migrateSavedConfig(legacy), /migration limit.*previous App version.*smaller backup/);
});
