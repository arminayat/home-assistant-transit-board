import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Script } from 'node:vm';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const manifest = await readFile('config.yaml', 'utf8');
assert.match(manifest, new RegExp(`version:\\s*["']?${pkg.version.replaceAll('.', '\\.')}["']?\\s`));
assert.match(manifest, /image:\s*["']?ghcr\.io\/arminayat\/home-assistant-transit-board["']?\s/);
assert.match(manifest, /ingress:\s*true/);
assert.match(manifest, /panel_admin:\s*false/);
assert.equal(pkg.license, 'MIT');
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(lock.packages[''].engines.node, pkg.engines.node);
assert.match(pkg.dependencies['transit-board-core'], /8fec0c7f6058525a91ab31143a41b566fd078a0f$/);
assert.ok(lock.packages['node_modules/transit-board-core'].integrity, 'Upstream source needs a locked integrity hash.');
const code = await readFile('dist/public/app.js', 'utf8');
new Script(code);
assert.ok(code.includes('transit-board-card-editor'), 'App must bundle the real editor.');
assert.ok(!/(?:^|;)\s*(?:import |export )/m.test(code), 'Browser bundle must be self-contained.');
const html = await readFile('dist/public/index.html', 'utf8');
assert.ok(!/(?:src|href)="\//.test(html), 'Assets must be ingress-relative.');
for (const file of ['dist/server.js', 'dist/server-lib.js', 'dist/LICENSE', 'dist/THIRD_PARTY_NOTICES.md']) {
  assert.ok((await readFile(file)).length > 0);
}
for (const directory of ['src', 'server', 'static', 'scripts', 'tests']) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const source = await readFile(path, 'utf8');
    assert.ok(source.split('\n').length <= 500, `${path} exceeds 500 lines.`);
  }
}
console.log('Package passed: pinned source, version, bundle, ingress assets, licenses and source limits.');
