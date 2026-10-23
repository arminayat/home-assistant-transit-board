#!/usr/bin/env bash
set -euo pipefail

image="${1:?Usage: container-smoke.sh IMAGE}"
smoke_id="transit-board-smoke-$$"
smoke_network="$smoke_id-network"
smoke_data="$(mktemp -d)"

cleanup() {
  local result=$?
  if [ "$result" -ne 0 ]; then docker logs "$smoke_id" 2>/dev/null || true; fi
  docker rm -f "$smoke_id" >/dev/null 2>&1 || true
  docker network rm "$smoke_network" >/dev/null 2>&1 || true
  rm -rf "$smoke_data"
}
trap cleanup EXIT

docker network create --subnet 172.30.32.0/24 "$smoke_network" >/dev/null
docker run --detach --name "$smoke_id" \
  --network "$smoke_network" --ip 172.30.32.10 --network-alias transit-board \
  --publish 127.0.0.1:18099:8099 \
  --mount "type=bind,source=$smoke_data,target=/data" "$image" >/dev/null

ingress_check() {
  docker run --rm --interactive --network "$smoke_network" --ip 172.30.32.2 \
    --env "SMOKE_PHASE=$1" --entrypoint node "$image" --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base = 'http://transit-board:8099/';
const request = (path, options = {}) => fetch(new URL(path, base), {
  signal: AbortSignal.timeout(5_000), ...options,
});
let healthy = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    healthy = (await request('health')).status === 200;
    if (healthy) break;
  } catch { /* Startup is allowed a short bounded wait. */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.ok(healthy, 'The production server did not become healthy through ingress.');
const response = await request('api/config');
assert.equal(response.status, 200);
const collection = await response.json();
assert.ok(Array.isArray(collection.cards));
const station = { id: '100001', name: 'Example station' };
const cards = [
  { id: 'smoke-buses', type: 'custom:transit-board-card', provider: 'bvg', title: 'Smoke buses', stops: [station], max_departures: 5 },
  { id: 'smoke-trains', type: 'custom:transit-board-card', provider: 'bvg', title: 'Smoke trains', stops: [station], max_departures: 5 },
  { id: 'smoke-norway', type: 'custom:transit-board-card', provider: 'entur', title: 'Norway sample',
    stops: [{ id: 'NSR:StopPlace:100001', name: 'Example station', products: ['rail'], destination: 'Example' }], max_departures: 6 },
  { id: 'smoke-swiss', type: 'custom:transit-board-card', provider: 'transport-ch', title: 'Switzerland sample',
    stops: [{ ...station, products: ['bus'], lines: ['10'], destination: 'Example' }], max_departures: 7 },
  { id: 'smoke-vag', type: 'custom:transit-board-card', provider: 'vag', title: 'Nürnberg sample',
    stops: [{ id: '510', name: 'Example station', products: ['suburban', 'subway', 'tram', 'bus'], lines: ['U1'], destination: 'Example' }], max_departures: 5 },
];
if (process.env.SMOKE_PHASE === 'initial') {
  assert.deepEqual(collection, { cards: [] }, 'A clean install must have no default cards or personal stops.');
  const page = await request('');
  assert.equal(page.status, 200);
  const html = await page.text();
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)];
  assert.ok(scripts.length, 'The app must load a browser JavaScript bundle.');
  for (const [, path] of scripts) {
    assert.ok(!path.startsWith('/') && !/^[a-z]+:/i.test(path), 'Assets must use ingress-safe relative paths.');
    const asset = await request(path);
    assert.equal(asset.status, 200);
    assert.ok((await asset.text()).length > 100);
  }
  const saved = await request('api/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Transit-Board': '2',
      'If-Match': response.headers.get('ETag'),
    },
    body: JSON.stringify({ cards }),
  });
  assert.equal(saved.status, 200, `Configuration write failed: ${await saved.text()}`);
} else {
  assert.deepEqual(collection, { cards }, 'Mixed-region cards and the repeated station must survive a container restart.');
}
console.log(`Ingress ${process.env.SMOKE_PHASE} checks passed.`);
JS
}

ingress_check initial
status="$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' \
  --header 'X-Forwarded-For: 172.30.32.2' http://127.0.0.1:18099/health)"
if [ "$status" != 403 ]; then
  echo "Non-ingress peer was not denied (HTTP $status)." >&2
  exit 1
fi
docker restart "$smoke_id" >/dev/null
ingress_check restarted
echo "Production container smoke checks passed."
