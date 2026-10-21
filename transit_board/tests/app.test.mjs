import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const html = await readFile('dist/public/index.html', 'utf8');
const code = await readFile('dist/public/app.js', 'utf8');
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const card = (id, title) => ({ id, type: 'custom:transit-board-card', title,
  stops: [{ id: '101', name: 'Example Square' }], max_departures: 5 });

async function mount(initial = { cards: [] }, url = 'https://example.invalid/api/hassio_ingress/sample/') {
  const dom = new Window({ url });
  let saved = clone(initial);
  let revision = 1;
  let put;
  const writes = [];
  const reads = [];
  const providerRequests = [];
  const intervals = new Set();
  const originalSetInterval = dom.setInterval.bind(dom);
  const originalClearInterval = dom.clearInterval.bind(dom);
  dom.setInterval = (...args) => { const timer = originalSetInterval(...args); intervals.add(timer); return timer; };
  dom.clearInterval = (timer) => { intervals.delete(timer); originalClearInterval(timer); };
  Object.defineProperty(dom.crypto, 'randomUUID', { value: undefined });
  dom.document.write(html.replace(/<script[^>]*><\/script>/, ''));
  dom.fetch = async (url, init) => {
    if (String(url).startsWith('https://v6.bvg.transport.rest/')) {
      providerRequests.push({ url: String(url), init });
      const body = String(url).includes('/locations?')
        ? [{ type: 'stop', id: '101', name: 'Example Square' }] : { departures: [] };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }
    if (init?.method === 'PUT') {
      writes.push({ url, init, body: JSON.parse(init.body) });
      if (put) {
        const response = await put();
        if (response instanceof Response) return response;
      }
      saved = JSON.parse(init.body);
      revision += 1;
    } else reads.push({ url, init });
    return new Response(JSON.stringify(saved), { headers: { ETag: `"${revision}"` } });
  };
  dom.eval(code);
  await flush();
  return { dom, writes, reads, providerRequests, intervals,
    saved: () => clone(saved), remote: (config) => { saved = clone(config); revision += 1; },
    holdWrites: (callback) => { put = callback; },
    close: async () => { dom.dispatchEvent(new dom.Event('pagehide')); await dom.happyDOM.abort(); } };
}

const get = (env, id) => env.dom.document.getElementById(id);
const article = (env, id) => [...get(env, 'cards').children].find((node) => node.dataset.cardId === id);
const gear = (env, id) => article(env, id).querySelector('.card-toolbar button');
const editor = (env) => env.dom.document.querySelector('transit-board-card-editor');
const title = (env) => editor(env).shadowRoot.querySelector('input[type=text]');
function editTitle(env, value) {
  const input = title(env);
  input.focus();
  input.value = value;
  input.dispatchEvent(new env.dom.Event('input', { bubbles: true }));
  return input;
}
async function selectStation(env) {
  const search = editor(env).shadowRoot.querySelector('input[type=search]');
  search.value = 'Example';
  search.dispatchEvent(new env.dom.Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  await flush();
  const add = [...editor(env).shadowRoot.querySelectorAll('button')].find((button) => button.textContent === 'Add stop');
  assert.equal(add.disabled, false);
  add.click();
  await flush();
}

test('successful Save closes card settings and restores focus to that card gear', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    gear(env, 'first').click();
    editTitle(env, 'First revised');
    assert.equal(get(env, 'settings-panel').hidden, false);
    get(env, 'save').click();
    await flush();
    assert.equal(env.saved().cards[0].title, 'First revised');
    assert.equal(get(env, 'settings-panel').hidden, true, 'Successful Save should close card settings.');
    assert.equal(editor(env), null, 'Closing settings must detach the editor and its searches.');
    assert.equal(env.dom.document.activeElement, gear(env, 'first'));
    gear(env, 'first').click();
    assert.equal(title(env).value, 'First revised', 'Reopening must show the saved settings.');
  } finally { await env.close(); }
});

test('invalid numeric form values block Save without discarding the visible draft', async () => {
  for (const value of ['', '0', '21', '1.5']) {
    const env = await mount({ cards: [card('first', 'First')] });
    try {
      gear(env, 'first').click();
      editTitle(env, 'Draft title');
      const maximum = editor(env).shadowRoot.querySelector('input[type=number]');
      maximum.value = value;
      maximum.dispatchEvent(new env.dom.Event('input', { bubbles: true }));
      assert.equal(get(env, 'save').disabled, true, `Maximum ${JSON.stringify(value)} must block Save.`);
      assert.equal(get(env, 'error').hidden, false);
      assert.match(get(env, 'error').textContent, /correct.*field/i);
      get(env, 'save').click();
      get(env, 'save').dispatchEvent(new env.dom.MouseEvent('click'));
      await flush();
      assert.equal(env.writes.length, 0, 'Invalid visible input must never save an older valid maximum.');
      assert.equal(get(env, 'settings-panel').hidden, false);
      editTitle(env, 'Still my draft');
      assert.equal(editor(env).shadowRoot.querySelector('input[type=number]'), maximum);
      assert.equal(maximum.value, value, 'Editing another field must preserve the invalid input.');
      assert.equal(get(env, 'save').disabled, true);
      maximum.value = '7';
      maximum.dispatchEvent(new env.dom.Event('input', { bubbles: true }));
      assert.equal(get(env, 'save').disabled, false);
      assert.equal(get(env, 'error').hidden, true);
      get(env, 'save').click();
      await flush();
      assert.equal(env.saved().cards[0].max_departures, 7);
      assert.equal(env.saved().cards[0].title, 'Still my draft');
      assert.equal(get(env, 'settings-panel').hidden, true);
    } finally { await env.close(); }
  }
});

test('editor theme survives card changes, setConfig rendering, and reopening without duplicate styles', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    gear(env, 'first').click();
    const element = editor(env);
    const root = element.shadowRoot;
    const sheets = [...root.adoptedStyleSheets];
    assert.equal(sheets.length, 1);
    gear(env, 'second').click();
    assert.equal(editor(env), element);
    assert.equal(title(env).value, 'Second');
    assert.deepEqual([...root.adoptedStyleSheets], sheets);
    get(env, 'cancel').click();
    gear(env, 'first').click();
    assert.equal(editor(env), element);
    assert.equal(title(env).value, 'First');
    assert.deepEqual([...root.adoptedStyleSheets], sheets);
  } finally { await env.close(); }
});

test('form-only invalid edits require discard and clear after Cancel, removal, or reload', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    const invalidate = () => {
      const field = editor(env).shadowRoot.querySelector('input[type=number]');
      field.value = '';
      field.dispatchEvent(new env.dom.Event('input', { bubbles: true }));
      return field;
    };
    gear(env, 'first').click();
    const maximum = invalidate();
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return false; };
    gear(env, 'second').click();
    assert.equal(confirmations, 1);
    assert.equal(maximum.value, '');
    assert.equal(title(env).value, 'First');
    const unload = new env.dom.Event('beforeunload', { cancelable: true });
    env.dom.dispatchEvent(unload);
    assert.equal(unload.defaultPrevented, true);
    const reads = env.reads.length;
    env.dom.dispatchEvent(new env.dom.Event('focus'));
    await flush();
    assert.equal(env.reads.length, reads, 'Refresh must not replace a form-only invalid edit.');
    get(env, 'cancel').click();
    gear(env, 'first').click();
    assert.equal(editor(env).shadowRoot.querySelector('input[type=number]').value, '5');
    editTitle(env, 'Fresh edit');
    assert.equal(get(env, 'save').disabled, false, 'Cancel must clear local invalidity.');
    invalidate();
    env.dom.confirm = () => true;
    get(env, 'remove-card').click();
    assert.equal(get(env, 'save').disabled, false, 'Confirmed removal replaces the invalid form.');
    get(env, 'cancel').click();
    gear(env, 'first').click();
    invalidate();
    get(env, 'reload').click();
    await flush();
    assert.equal(editor(env).shadowRoot.querySelector('input[type=number]').value, '5');
    assert.equal(get(env, 'error').hidden, true);
    editTitle(env, 'After reload');
    assert.equal(get(env, 'save').disabled, false, 'Reload must clear local invalidity.');
    assert.equal(env.writes.length, 0);
  } finally { await env.close(); }
});

test('failed and conflicting saves retain the open editor and unsaved draft', async () => {
  for (const status of [500, 412]) {
    const env = await mount({ cards: [card('first', 'First')] });
    try {
      gear(env, 'first').click();
      const input = editTitle(env, 'Keep my draft');
      env.holdWrites(async () => new Response(JSON.stringify({ error: 'Could not save settings.' }), { status }));
      get(env, 'save').click();
      await flush();
      assert.equal(get(env, 'settings-panel').hidden, false, `HTTP ${status} must not close settings.`);
      assert.equal(title(env), input, 'Failed Save should retain the same input element.');
      assert.equal(input.value, 'Keep my draft');
      assert.equal(env.saved().cards[0].title, 'First');
      assert.equal(get(env, 'error').hidden, false);
      assert.equal(get(env, 'save').disabled, false, 'A failed Save remains retryable.');
      assert.equal(editor(env).inert, false);
      env.holdWrites(async () => {});
      get(env, 'save').click();
      await flush();
      assert.equal(get(env, 'settings-panel').hidden, true, 'A successful retry should close settings.');
      assert.equal(env.dom.document.activeElement, gear(env, 'first'));
    } finally { await env.close(); }
  }
});

test('a successful response with remaining unsaved settings leaves the editor open', async () => {
  const env = await mount({ cards: [card('first', 'First')] });
  try {
    gear(env, 'first').click();
    const input = editTitle(env, 'My draft');
    env.holdWrites(async () => new Response(JSON.stringify({ cards: [card('first', 'Different saved value')] }), {
      headers: { ETag: '"2"' },
    }));
    get(env, 'save').click();
    await flush();
    assert.equal(get(env, 'settings-panel').hidden, false);
    assert.equal(title(env), input);
    assert.equal(input.value, 'My draft');
    assert.equal(get(env, 'save').disabled, false);
    assert.match(get(env, 'status').textContent, /unsaved changes/);
  } finally { await env.close(); }
});

test('empty HTTP installation has accessible Add card, no default card, and Cancel drops a new draft', async () => {
  const env = await mount({ cards: [] }, 'http://example.invalid/api/hassio_ingress/sample/');
  try {
    assert.equal(get(env, 'intro').hidden, false);
    assert.equal(env.dom.document.querySelector('transit-board-card'), null);
    assert.equal(editor(env), null);
    assert.equal(get(env, 'add-card').getAttribute('aria-label'), 'Add card');
    assert.equal(get(env, 'add-card').querySelector('svg').getAttribute('aria-hidden'), 'true');
    get(env, 'add-first-card').click();
    const id = get(env, 'cards').firstElementChild.dataset.cardId;
    assert.match(id, /^[a-f0-9]{32}$/, 'IDs also work without secure-context randomUUID.');
    assert.ok(editor(env)?.shadowRoot);
    const input = editTitle(env, 'Draft <img src=x>');
    assert.equal(title(env), input);
    assert.equal(editor(env).shadowRoot.activeElement, input);
    assert.equal(env.dom.document.querySelector('img'), null);
    assert.equal(env.writes.length, 0);
    get(env, 'cancel').click();
    assert.equal(get(env, 'cards').children.length, 0);
    assert.equal(get(env, 'intro').hidden, false);
    get(env, 'add-card').click();
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return true; };
    get(env, 'remove-card').click();
    assert.equal(confirmations, 0, 'Removing an unsaved draft needs no deletion confirmation.');
    assert.equal(get(env, 'cards').children.length, 0);
    assert.deepEqual(env.saved(), { cards: [] });
  } finally { await env.close(); }
});

test('two cards can select the same station, save different titles, and edit independently without reconnecting the other', async () => {
  const env = await mount();
  try {
    get(env, 'add-card').click();
    editTitle(env, 'Morning');
    await selectStation(env);
    assert.equal(env.writes.length, 0);
    get(env, 'save').click();
    await flush();
    const firstId = env.saved().cards[0].id;
    assert.equal(get(env, 'settings-panel').hidden, true, 'A newly saved card should close its editor.');
    assert.equal(env.dom.document.activeElement, gear(env, firstId));
    get(env, 'add-card').click();
    editTitle(env, 'Evening');
    await selectStation(env);
    get(env, 'save').click();
    await flush();
    const [first, second] = env.saved().cards;
    assert.notEqual(first.id, second.id);
    assert.deepEqual(first.stops, second.stops);
    assert.deepEqual([first.title, second.title], ['Morning', 'Evening']);
    const otherArticle = article(env, second.id);
    const otherBoard = otherArticle.querySelector('transit-board-card');
    const otherHeading = otherBoard.shadowRoot.querySelector('h2');
    let otherUpdates = 0;
    const original = otherBoard.setConfig.bind(otherBoard);
    otherBoard.setConfig = (value) => { otherUpdates += 1; original(value); };
    gear(env, firstId).click();
    const field = editTitle(env, 'Morning revised');
    assert.equal(title(env), field);
    assert.equal(article(env, second.id), otherArticle);
    assert.equal(otherArticle.querySelector('transit-board-card'), otherBoard);
    assert.equal(otherBoard.shadowRoot.querySelector('h2'), otherHeading);
    assert.equal(otherUpdates, 0);
    get(env, 'save').click();
    await flush();
    assert.equal(env.saved().cards[0].title, 'Morning revised');
    assert.deepEqual(env.saved().cards[1], second);
    assert.ok(env.providerRequests.every(({ init }) => init.credentials === 'omit'));
    assert.ok(env.intervals.size >= 3, 'App and both visible station cards have active intervals.');
    env.dom.dispatchEvent(new env.dom.Event('pagehide'));
    assert.equal(env.intervals.size, 0, 'Detaching the app clears card and app intervals.');
    assert.equal(otherBoard.isConnected, false);
    assert.equal(editor(env), null);
  } finally { await env.close(); }
});

test('dirty switching requires confirmation, invalid drafts block Save, and in-flight saves disable mutations', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    gear(env, 'first').click();
    const input = editTitle(env, 'Unsaved');
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return false; };
    gear(env, 'second').click();
    get(env, 'add-card').click();
    assert.equal(confirmations, 2);
    assert.equal(title(env), input);
    assert.equal(input.value, 'Unsaved');
    env.dom.confirm = () => true;
    gear(env, 'second').click();
    assert.equal(title(env).value, 'Second');
    assert.equal(article(env, 'first').querySelector('transit-board-card').shadowRoot.querySelector('h2').textContent, 'First');
    editor(env).dispatchEvent(new env.dom.CustomEvent('config-changed', { detail: { config: null } }));
    assert.equal(get(env, 'save').disabled, true);
    assert.equal(get(env, 'error').hidden, false);
    assert.equal(title(env).value, 'Second');
    editTitle(env, 'Saved second');
    let finish;
    env.holdWrites(() => new Promise((resolve) => { finish = resolve; }));
    get(env, 'save').click();
    await flush();
    assert.equal(get(env, 'settings-panel').hidden, false, 'A pending Save must keep settings open.');
    for (const control of [get(env, 'add-card'), gear(env, 'first'), gear(env, 'second'), get(env, 'remove-card'), get(env, 'cancel')]) {
      assert.equal(control.disabled, true);
    }
    assert.equal(editor(env).inert, true);
    finish();
    await flush();
    assert.equal(env.saved().cards[1].title, 'Saved second');
    assert.equal(get(env, 'add-card').disabled, false);
    assert.equal(get(env, 'settings-panel').hidden, true);
    assert.equal(env.dom.document.activeElement, gear(env, 'second'));
  } finally { await env.close(); }
});

test('saved removal confirms, previews a disconnected card, supports Cancel, then persists through explicit Save', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    const board = article(env, 'first').querySelector('transit-board-card');
    const other = article(env, 'second');
    gear(env, 'first').click();
    env.dom.confirm = () => false;
    get(env, 'remove-card').click();
    assert.equal(board.isConnected, true);
    env.dom.confirm = () => true;
    get(env, 'remove-card').click();
    assert.equal(board.isConnected, false);
    assert.equal(get(env, 'removal-notice').hidden, false);
    assert.equal(get(env, 'save').disabled, false);
    assert.equal(env.writes.length, 0);
    get(env, 'cancel').click();
    assert.equal(board.isConnected, true);
    gear(env, 'first').click();
    get(env, 'remove-card').click();
    get(env, 'save').click();
    await flush();
    assert.deepEqual(env.saved().cards.map((item) => item.id), ['second']);
    assert.equal(article(env, 'first'), undefined);
    assert.equal(article(env, 'second'), other);
    assert.equal(get(env, 'settings-panel').hidden, true);
    assert.equal(env.dom.document.activeElement, get(env, 'add-card'));
  } finally { await env.close(); }
});

test('failed removal keeps its confirmation draft until a successful Save focuses Add card', async () => {
  const env = await mount({ cards: [card('first', 'First')] });
  try {
    gear(env, 'first').click();
    env.dom.confirm = () => true;
    get(env, 'remove-card').click();
    env.holdWrites(async () => new Response(JSON.stringify({ error: 'Storage unavailable.' }), { status: 500 }));
    get(env, 'save').click();
    await flush();
    assert.equal(get(env, 'settings-panel').hidden, false);
    assert.equal(get(env, 'removal-notice').hidden, false);
    assert.equal(env.saved().cards.length, 1);
    assert.equal(get(env, 'save').disabled, false);
    env.holdWrites(async () => {});
    get(env, 'save').click();
    await flush();
    assert.equal(env.saved().cards.length, 0);
    assert.equal(get(env, 'settings-panel').hidden, true);
    assert.equal(get(env, 'intro').hidden, false);
    assert.equal(env.dom.document.activeElement, get(env, 'add-card'));
  } finally { await env.close(); }
});

test('remote collection updates keep the active draft until confirmed reload and retain unaffected card elements', async () => {
  const env = await mount({ cards: [card('first', 'First'), card('second', 'Second')] });
  try {
    const other = article(env, 'second').querySelector('transit-board-card');
    gear(env, 'first').click();
    const input = editTitle(env, 'My draft');
    env.remote({ cards: [card('first', 'Remote title'), card('second', 'Second')] });
    env.dom.dispatchEvent(new env.dom.Event('focus'));
    await flush();
    assert.equal(get(env, 'shared-change').hidden, false);
    assert.equal(title(env), input);
    assert.equal(input.value, 'My draft');
    env.dom.confirm = () => false;
    get(env, 'reload').click();
    await flush();
    assert.equal(title(env).value, 'My draft');
    env.dom.confirm = () => true;
    get(env, 'reload').click();
    await flush();
    assert.equal(title(env).value, 'Remote title');
    assert.equal(get(env, 'shared-change').hidden, true);
    assert.equal(article(env, 'second').querySelector('transit-board-card'), other);
    assert.equal(env.writes.length, 0);
  } finally { await env.close(); }
});
