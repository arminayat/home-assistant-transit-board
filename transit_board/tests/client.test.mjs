import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { loadConfig, saveConfig, ConflictError } from '../dist/client.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const config = { cards: [{ id: 'first', type: 'custom:transit-board-card', stops: [], max_departures: 5 }] };
const response = (body = config, status = 200, etag = '"1"') => new Response(JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) } });

test('settings requests remain relative to ingress and send no credentials to the provider', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return response(); };
  assert.equal((await loadConfig()).etag, '"1"');
  await saveConfig(config, '"1"');
  assert.deepEqual(calls.map((call) => call.url), ['api/config', 'api/config']);
  assert.equal(calls[1].init.credentials, 'same-origin');
  assert.equal(calls[1].init.headers['X-Transit-Board'], '1');
  assert.equal(calls[1].init.headers['If-Match'], '"1"');
  assert.deepEqual(JSON.parse(calls[1].init.body), config);
});

test('conflicts, expired sessions and corrupt server state have actionable errors', async () => {
  globalThis.fetch = async () => response({ error: 'stale' }, 412);
  await assert.rejects(saveConfig(config, '"1"'), ConflictError);
  globalThis.fetch = async () => response({}, 403);
  await assert.rejects(loadConfig(), /Reopen Transit Board/);
  globalThis.fetch = async () => response({ error: 'Restore saved file from backup' }, 503);
  await assert.rejects(loadConfig(), /backup/);
});

test('settings without valid configuration or a revision are rejected', async () => {
  globalThis.fetch = async () => response(config, 200, '');
  await assert.rejects(loadConfig(), /without a revision/);
  globalThis.fetch = async () => response({ cards: 'broken' });
  await assert.rejects(loadConfig(), /cards|Cards/);
});
