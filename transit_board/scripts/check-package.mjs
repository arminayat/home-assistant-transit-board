import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { Script } from 'node:vm';
import { createHash } from 'node:crypto';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const manifest = await readFile('config.yaml', 'utf8');
assert.match(manifest, new RegExp(`version:\\s*["']?${pkg.version.replaceAll('.', '\\.')}["']?\\s`));
assert.match(manifest, /image:\s*["']?ghcr\.io\/arminayat\/home-assistant-transit-board["']?\s/);
assert.match(manifest, /ingress:\s*true/);
assert.match(manifest, /panel_admin:\s*false/);
assert.equal(pkg.license, 'MIT');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(lock.packages[''].engines.node, pkg.engines.node);
assert.equal(pkg.dependencies['transit-board-core'], 'file:vendor/transit-board-card');
assert.equal(lock.packages[''].dependencies['transit-board-core'], pkg.dependencies['transit-board-core']);
const vendorRoot = 'vendor/transit-board-card';
const upstreamCommit = '8fec0c7f6058525a91ab31143a41b566fd078a0f';
const vendorPackage = JSON.parse(await readFile(join(vendorRoot, 'package.json'), 'utf8'));
const upstream = JSON.parse(await readFile(join(vendorRoot, 'UPSTREAM.json'), 'utf8'));
assert.equal(lock.packages['node_modules/transit-board-core'].resolved, vendorRoot);
assert.equal(lock.packages['node_modules/transit-board-core'].link, true);
assert.equal(lock.packages[vendorRoot].version, vendorPackage.version);
assert.equal(vendorPackage.license, 'MIT');
assert.equal(vendorPackage.version, '0.1.0-beta.1');
assert.equal(vendorPackage.upstreamCommit, upstreamCommit);
assert.equal(upstream.repository, 'https://github.com/arminayat/transit-board-card');
assert.equal(upstream.commit, upstreamCommit);
assert.deepEqual(Object.keys(upstream.files).sort(), ['LICENSE', 'src/api.ts', 'src/board-view.ts',
  'src/card.ts', 'src/config.ts', 'src/departures.ts', 'src/editor.ts', 'src/index.ts', 'src/styles.ts', 'src/types.ts']);
for (const [file, expected] of Object.entries(upstream.files)) {
  assert.match(expected, /^[a-f0-9]{64}$/);
  const actual = createHash('sha256').update(await readFile(join(vendorRoot, file))).digest('hex');
  assert.equal(actual, expected, `Vendored source differs from the recorded snapshot: ${file}`);
}
const dockerfile = await readFile('Dockerfile', 'utf8');
assert.ok(dockerfile.includes(`ARG BUILD_VERSION=${pkg.version}\n`), 'Docker default version must match the package.');
const code = await readFile('dist/public/app.js', 'utf8');
new Script(code);
assert.ok(code.includes('transit-board-card-editor'), 'App must bundle the real editor.');
assert.ok(!/(?:^|;)\s*(?:import |export )/m.test(code), 'Browser bundle must be self-contained.');
const html = await readFile('dist/public/index.html', 'utf8');
assert.ok(!/(?:src|href)="\//.test(html), 'Assets must be ingress-relative.');
for (const file of ['dist/server.js', 'dist/server-lib.js', 'dist/LICENSE', 'dist/THIRD_PARTY_NOTICES.md']) {
  assert.ok((await readFile(file)).length > 0);
}
const { createAppServer } = await import('../dist/server-lib.js');
const packageData = await mkdtemp(join(tmpdir(), 'transit-board-package-'));
const server = createAppServer({ dataDir: packageData, staticDir: join(process.cwd(), 'dist/public'),
  development: true });
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/api/config`;
  const response = await fetch(endpoint);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { cards: [] }, 'The built server must expose the empty card collection.');
  const collection = { cards: [{ id: 'package', type: 'custom:transit-board-card', title: 'Package check',
    stops: [], max_departures: 5 }] };
  const saved = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json',
    'X-Transit-Board': '1', 'If-Match': response.headers.get('ETag') }, body: JSON.stringify(collection) });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), collection);
  assert.deepEqual(JSON.parse(await readFile(join(packageData, 'config.json'), 'utf8')), collection);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(packageData, { recursive: true, force: true });
}
for (const directory of ['src', 'server', 'static', 'scripts', 'tests']) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const source = await readFile(path, 'utf8');
    assert.ok(source.split('\n').length <= 500, `${path} exceeds 500 lines.`);
  }
}
console.log('Package passed: vendored source hashes, version, bundle, collection API, ingress assets, licenses and source limits.');
