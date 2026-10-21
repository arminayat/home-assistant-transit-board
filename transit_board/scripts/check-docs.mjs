import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

const root = resolve('..');
async function markdown(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', '.dev-data'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdown(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}
const files = await markdown(root);
let links = 0;
for (const path of files) {
  const source = await readFile(path, 'utf8');
  assert.match(source, /^#{1,2} /, `${path}: needs an opening heading.`);
  assert.equal((source.match(/^```/gm) ?? []).length % 2, 0, `${path}: unclosed code block.`);
  for (const match of source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    assert.ok(!target.startsWith('/'), `${path}: use portable relative documentation links.`);
    await stat(resolve(dirname(path), decodeURIComponent(target)));
    links++;
  }
}
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  assert.equal(await readFile(name, 'utf8'), await readFile(join(root, name), 'utf8'), `${name} must match the root notice.`);
}
console.log(`Documentation passed: ${files.length} Markdown files and ${links} local links.`);
