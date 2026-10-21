import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [new URL("../server/app.ts", import.meta.url).pathname],
  bundle: true, write: false, platform: "node", format: "esm", target: "node22",
});
const { createAppServer } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);
const empty = { type: "custom:transit-board-card", stops: [], max_departures: 5 };
const config = (title) => ({ ...empty, title, stops: [{ id: "100001", name: "Example station" }] });
const headers = (etag) => ({ "Content-Type": "application/json", "X-Transit-Board": "1", ...(etag ? { "If-Match": etag } : {}) });

async function fixture(t, { development = true, stored, peer, directoryInsteadOfConfig = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "transit-board-test-"));
  const dataDir = join(root, "data");
  const staticDir = join(root, "static");
  await mkdir(dataDir);
  await mkdir(staticDir);
  await writeFile(join(staticDir, "index.html"), "<!doctype html><title>Transit</title>");
  await writeFile(join(staticDir, "app.js"), "/* example JavaScript */");
  await writeFile(join(staticDir, "app.css"), "body { color: black; }");
  if (stored !== undefined) await writeFile(join(dataDir, "config.json"), stored);
  if (directoryInsteadOfConfig) await mkdir(join(dataDir, "config.json"));
  const server = createAppServer({ dataDir, staticDir, development });
  if (peer) server.prependListener("request", (request) => {
    Object.defineProperty(request.socket, "remoteAddress", { value: peer, configurable: true });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const read = () => fetch(`${origin}/api/config`);
  const save = (value, etag, extra = {}) => fetch(`${origin}/api/config`, {
    method: "PUT", headers: { ...headers(etag), ...extra }, body: JSON.stringify(value),
  });
  return { root, dataDir, staticDir, server, origin, read, save };
}

test("starts with a normalized empty board without creating storage", async (t) => {
  const f = await fixture(t);
  const response = await f.read();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), empty);
  assert.match(response.headers.get("etag"), /^"[a-f0-9]{64}"$/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await readdir(f.dataDir), []);
  assert.equal((await fetch(`${f.origin}/health`)).status, 200);
});

test("normalizes, atomically persists and reloads the saved board", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const value = { ...config("  Example board  "), stops: [{ id: "100001", name: " Station ", lines: [" u5 ", "U5"] }] };
  const saved = await f.save(value, initial.headers.get("etag"));
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.title, "Example board");
  assert.deepEqual(body.stops, [{ id: "100001", name: "Station", lines: ["U5"] }]);
  assert.notEqual(saved.headers.get("etag"), initial.headers.get("etag"));
  assert.deepEqual(JSON.parse(await readFile(join(f.dataDir, "config.json"), "utf8")), body);
  assert.deepEqual(await readdir(f.dataDir), ["config.json"]);
  const restarted = createAppServer({ dataDir: f.dataDir, staticDir: f.staticDir, development: true });
  restarted.listen(0, "127.0.0.1");
  await once(restarted, "listening");
  try {
    const reloaded = await fetch(`http://127.0.0.1:${restarted.address().port}/api/config`);
    assert.equal(reloaded.headers.get("etag"), saved.headers.get("etag"));
    assert.deepEqual(await reloaded.json(), body);
  } finally {
    restarted.closeAllConnections();
    await new Promise((resolve) => restarted.close(resolve));
  }
});

test("conditional reads return 304 without a response body", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const response = await fetch(`${f.origin}/api/config`, { headers: { "If-None-Match": initial.headers.get("etag") } });
  assert.equal(response.status, 304);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("etag"), initial.headers.get("etag"));
});

test("requires conditional saves and rejects stale snapshots without overwriting", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.save(config("Without ETag"))).status, 428);
  const initial = await f.read();
  const etag = initial.headers.get("etag");
  assert.equal((await f.save(config("First"), etag)).status, 200);
  const stale = await f.save(config("Stale"), etag);
  assert.equal(stale.status, 412);
  assert.match((await stale.json()).error, /changed elsewhere/);
  assert.equal((await (await f.read()).json()).title, "First");
});

test("serializes simultaneous saves so exactly one writer succeeds", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const responses = await Promise.all([
    f.save(config("Writer A"), initial.headers.get("etag")),
    f.save(config("Writer B"), initial.headers.get("etag")),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 412]);
  const winning = await responses.find((response) => response.status === 200).json();
  assert.deepEqual(await (await f.read()).json(), winning);
  assert.deepEqual(JSON.parse(await readFile(join(f.dataDir, "config.json"), "utf8")), winning);
});

test("validates stop count and upstream configuration without changing the saved snapshot", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const etag = initial.headers.get("etag");
  const cases = [
    { ...empty, stops: Array.from({ length: 21 }, (_, index) => ({ id: String(index), name: "Example" })) },
    { ...empty, max_departures: 0 },
    { ...empty, stops: [{ id: "not-numeric", name: "Example" }] },
    { ...empty, stops: [{ id: "100001", name: "Example", products: [] }] },
  ];
  for (const value of cases) assert.equal((await f.save(value, etag)).status, 400);
  const response = await f.read();
  assert.equal(response.headers.get("etag"), etag);
  assert.deepEqual(await response.json(), empty);
  const valid = { ...empty, stops: Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: "Example" })) };
  assert.equal((await f.save(valid, etag)).status, 200);
});

test("rejects oversized bodies and malformed JSON", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const etag = initial.headers.get("etag");
  const oversized = await f.save({ ...empty, title: "x".repeat(65_536) }, etag);
  assert.equal(oversized.status, 413);
  const malformed = await fetch(`${f.origin}/api/config`, { method: "PUT", headers: headers(etag), body: "{" });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await (await f.read()).json(), empty);
});

test("enforces the size limit even when chunked transfer omits Content-Length", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest(`${f.origin}/api/config`, {
      method: "PUT", headers: { ...headers(initial.headers.get("etag")), "Transfer-Encoding": "chunked" },
    }, (response) => { response.resume(); response.on("end", () => resolve(response.statusCode)); });
    request.on("error", reject);
    request.write(" ".repeat(32_768));
    request.end(" ".repeat(32_769));
  });
  assert.equal(status, 413);
  assert.deepEqual(await (await f.read()).json(), empty);
});

test("requires JSON and the same-origin custom header, without CORS", async (t) => {
  const f = await fixture(t);
  const initial = await f.read();
  const etag = initial.headers.get("etag");
  const simple = await fetch(`${f.origin}/api/config`, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": etag }, body: "{}" });
  assert.equal(simple.status, 403);
  assert.equal((await f.save(empty, etag, { "Content-Type": "text/plain" })).status, 415);
  const preflight = await fetch(`${f.origin}/api/config`, { method: "OPTIONS", headers: { Origin: "https://attacker.invalid" } });
  assert.equal(preflight.status, 405);
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await (await f.read()).json(), empty);
});

test("production denies direct connections and ignores forwarded identity headers", async (t) => {
  const f = await fixture(t, { development: false });
  const response = await fetch(`${f.origin}/api/config`, {
    headers: { "X-Forwarded-For": "172.30.32.2", "X-Real-IP": "172.30.32.2" },
  });
  assert.equal(response.status, 403);
  assert.equal((await fetch(`${f.origin}/health`)).status, 403);
});

test("production accepts the actual ingress peer including mapped IPv4", async (t) => {
  for (const peer of ["172.30.32.2", "::ffff:172.30.32.2"]) {
    const f = await fixture(t, { development: false, peer });
    assert.equal((await f.read()).status, 200);
  }
});

test("development mode still denies non-loopback clients", async (t) => {
  const f = await fixture(t, { peer: "192.0.2.1" });
  assert.equal((await f.read()).status, 403);
});

test("serves only allowlisted assets with security headers and expected content types", async (t) => {
  const f = await fixture(t);
  for (const [path, type] of [["/", "text/html"], ["/app.js", "text/javascript"], ["/app.css", "text/css"]]) {
    const response = await fetch(`${f.origin}${path}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), new RegExp(type));
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /connect-src 'self' https:\/\/v6\.bvg\.transport\.rest/);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'self'/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  for (const path of ["/config.json", "/server/app.ts", "/%2f../config.json"]) {
    assert.equal((await fetch(`${f.origin}${path}`)).status, 404);
  }
  assert.equal((await fetch(`${f.origin}/`, { method: "POST" })).status, 405);
});

test("preserves corrupt storage, reports recovery guidance and refuses replacement", async (t) => {
  const original = "{ broken saved configuration";
  const f = await fixture(t, { stored: original });
  const response = await f.read();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /preserved/);
  assert.equal((await f.save(empty, '"attempt-replacement"')).status, 503);
  assert.equal(await readFile(join(f.dataDir, "config.json"), "utf8"), original);
  assert.equal((await fetch(`${f.origin}/health`)).status, 503);
});

test("unreadable storage and oversized saved documents are not reset", async (t) => {
  const unreadable = await fixture(t, { directoryInsteadOfConfig: true });
  assert.equal((await unreadable.read()).status, 503);
  const oversized = await fixture(t, { stored: " ".repeat(65_537) });
  assert.equal((await oversized.read()).status, 503);
  assert.equal((await readFile(join(oversized.dataDir, "config.json"))).byteLength, 65_537);
});

test("a failed disk write keeps the prior snapshot and does not poison later saves", async (t) => {
  const f = await fixture(t, { stored: JSON.stringify(config("Original")) });
  const initial = await f.read();
  const etag = initial.headers.get("etag");
  const previous = `${f.dataDir}-previous`;
  await rename(f.dataDir, previous);
  await writeFile(f.dataDir, "storage temporarily unavailable");
  const failure = await f.save(config("Failed write"), etag);
  assert.equal(failure.status, 500);
  assert.equal((await (await f.read()).json()).title, "Original");
  assert.equal(JSON.parse(await readFile(join(previous, "config.json"), "utf8")).title, "Original");
  await rm(f.dataDir);
  await rename(previous, f.dataDir);
  assert.equal((await f.save(config("Recovered"), etag)).status, 200);
  assert.equal((await (await f.read()).json()).title, "Recovered");
});

test("the development CLI saves under its working directory and shuts down on SIGTERM", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "transit-board-cli-"));
  const executable = join(root, "server.mjs");
  await build({ entryPoints: [new URL("../server/index.ts", import.meta.url).pathname],
    outfile: executable, bundle: true, platform: "node", format: "esm", target: "node22" });
  const probe = createAppServer({ dataDir: join(root, "unused"), staticDir: root, development: true });
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const environment = { ...process.env, PORT: String(port) };
  delete environment.DATA_DIR;
  const child = spawn(process.execPath, [executable, "--dev"], { cwd: root, env: environment, stdio: "ignore" });
  const exited = once(child, "exit");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
    await rm(root, { recursive: true, force: true });
  });
  let initial;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      initial = await fetch(`http://127.0.0.1:${port}/api/config`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  assert.equal(initial?.status, 200, "The local development server must start.");
  const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: "PUT", headers: headers(initial.headers.get("etag")), body: JSON.stringify(config("CLI board")),
  });
  assert.equal(response.status, 200);
  const stored = JSON.parse(await readFile(join(root, ".dev-data", "config.json"), "utf8"));
  assert.equal(stored.title, "CLI board");
  child.kill("SIGTERM");
  assert.deepEqual(await exited, [0, null]);
});
