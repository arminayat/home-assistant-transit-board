import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const html = await readFile('dist/public/index.html', 'utf8');
const code = await readFile('dist/public/app.js', 'utf8');
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };

test('built App mounts real components, previews locally, saves and cancels without a browser', async () => {
  const dom = new Window({ url: 'https://example.invalid/api/hassio_ingress/sample/' });
  const calls = [];
  let saved = { type: 'custom:transit-board-card', stops: [], max_departures: 5 };
  try {
    dom.document.write(html.replace(/<script[^>]*><\/script>/, ''));
    dom.fetch = async (url, init) => {
      calls.push({ url, init });
      if (init?.method === 'PUT') saved = JSON.parse(init.body);
      return new Response(JSON.stringify(saved), { headers: { ETag: init?.method === 'PUT' ? '"2"' : '"1"' } });
    };
    dom.eval(code);
    await flush();
    const board = dom.document.querySelector('transit-board-card');
    const editor = dom.document.querySelector('transit-board-card-editor');
    assert.ok(board?.shadowRoot);
    assert.ok(editor?.shadowRoot, 'An empty installation opens station settings.');
    const title = editor.shadowRoot.querySelector('input[type=text]');
    title.value = 'My board <img src=x>';
    title.dispatchEvent(new dom.Event('input', { bubbles: true }));
    assert.equal(calls.length, 1, 'Preview must not write settings.');
    assert.equal(editor.shadowRoot.querySelector('input[type=text]'), title, 'Typing must preserve field focus.');
    assert.equal(board.shadowRoot.querySelector('img'), null);
    const save = dom.document.getElementById('save');
    assert.equal(save.disabled, false);
    save.click();
    await flush();
    assert.equal(saved.title, 'My board <img src=x>');
    assert.equal(calls[1].url, 'api/config');
    assert.match(dom.document.getElementById('status').textContent, /saved for everyone/);
    title.value = 'Discard me';
    title.dispatchEvent(new dom.Event('input', { bubbles: true }));
    dom.document.getElementById('cancel').click();
    assert.equal(dom.document.getElementById('settings-panel').hidden, true);
    assert.equal(dom.document.getElementById('settings').hidden, false);
    assert.equal(calls.length, 2);
    dom.document.getElementById('settings').click();
    assert.equal(dom.document.querySelector('transit-board-card-editor').shadowRoot.querySelector('input[type=text]').value, saved.title);
    dom.dispatchEvent(new dom.Event('pagehide'));
    assert.equal(board.isConnected, false);
  } finally { await dom.happyDOM.abort(); }
});

test('a fresh installation can search a station, add it, fetch departures and save the shared choice', async () => {
  const dom = new Window({ url: 'https://example.invalid/api/hassio_ingress/sample/' });
  let saved = { type: 'custom:transit-board-card', stops: [], max_departures: 5 };
  const providerRequests = [];
  try {
    dom.document.write(html.replace(/<script[^>]*><\/script>/, ''));
    dom.fetch = async (url, init) => {
      if (String(url).startsWith('https://v6.bvg.transport.rest/')) {
        providerRequests.push({ url: String(url), init });
        const body = String(url).includes('/locations?')
          ? [{ type: 'stop', id: '101', name: 'Example Square' }] : { departures: [] };
        return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      }
      if (init?.method === 'PUT') saved = JSON.parse(init.body);
      return new Response(JSON.stringify(saved), { headers: { ETag: '"1"' } });
    };
    dom.eval(code);
    await flush();
    const editor = dom.document.querySelector('transit-board-card-editor');
    const search = editor.shadowRoot.querySelector('input[type=search]');
    search.value = 'Example';
    search.dispatchEvent(new dom.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await flush();
    const add = [...editor.shadowRoot.querySelectorAll('button')].find((button) => button.textContent === 'Add stop');
    assert.equal(add.disabled, false);
    add.click();
    await flush();
    assert.equal(saved.stops.length, 0, 'Selected station remains a draft until Save.');
    assert.ok(providerRequests.some(({ url }) => url.includes('/stops/101/departures?')));
    assert.ok(providerRequests.every(({ init }) => init.credentials === 'omit'));
    dom.document.getElementById('save').click();
    await flush();
    assert.deepEqual(saved.stops, [{ id: '101', name: 'Example Square' }]);
    assert.match(dom.document.getElementById('status').textContent, /saved for everyone/);
    dom.dispatchEvent(new dom.Event('pagehide'));
  } finally { await dom.happyDOM.abort(); }
});
