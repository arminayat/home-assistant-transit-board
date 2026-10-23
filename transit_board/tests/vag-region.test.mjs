import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const html = await readFile('dist/public/index.html', 'utf8');
const code = await readFile('dist/public/app.js', 'utf8');
const now = Date.parse('2026-01-15T12:00:00Z');
const timestamp = (minutes) => new Date(now + minutes * 60_000).toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const station = { id: '510', name: 'VAG Example' };
const sourceUrl = 'https://opendata.vag.de/dataset/api-echtzeitauskunft';
const metadata = { Version: 'Puls-API-v1.3.0', Timestamp: timestamp(0) };
const berlin = { id: 'berlin', type: 'custom:transit-board-card', provider: 'bvg', title: 'Berlin card',
  stops: [{ id: '101', name: 'Berlin Example' }], max_departures: 5 };
const json = (body, headers = {}) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json', ...headers },
});

function departure(line, direction, product, minutes) {
  return { Linienname: line, Richtungstext: direction, Produkt: product,
    Haltepunkt: 'EX:1', AbfahrtszeitSoll: timestamp(minutes), AbfahrtszeitIst: timestamp(minutes),
    Fahrtnummer: minutes, Betriebstag: '2026-01-15', Prognose: true, HaltesteigText: '1' };
}

async function mount(cards = []) {
  const dom = new Window({ url: 'https://example.invalid/api/hassio_ingress/vag/' });
  let saved = { cards: clone(cards) };
  let revision = 1;
  const requests = [];
  const writes = [];
  dom.Date.now = () => now;
  dom.document.write(html.replace(/<script[^>]*><\/script>/, ''));
  dom.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'api/config') {
      if (init?.method === 'PUT') {
        assert.equal(init.headers['If-Match'], `"${revision}"`);
        writes.push(JSON.parse(init.body));
        saved = JSON.parse(init.body);
        revision += 1;
      }
      return json(saved, { ETag: `"${revision}"` });
    }
    requests.push({ url, init });
    if (url.startsWith('https://start.vag.de/dm/api/v1/haltestellen/VGN?')) {
      return json({ Metadata: metadata, Haltestellen: [{ VGNKennung: 510, Haltestellenname: station.name }] });
    }
    if (url.startsWith('https://start.vag.de/dm/api/v1/abfahrten/VGN/510?')) {
      return json({ Metadata: metadata, Haltestellenname: station.name, VGNKennung: 510, Abfahrten: [
        departure('U1', 'Example Centre <img src=x>', 'UBahn', 10),
        departure('U2', 'Example Centre', 'UBahn', 12),
        departure('U1', 'Example Outer', 'UBahn', 14),
        departure('U1', 'Example Centre', 'Bus', 16),
      ] });
    }
    if (url.startsWith('https://v6.bvg.transport.rest/')) return json({ departures: [] });
    throw new Error(`Unexpected provider request: ${url}`);
  };
  dom.eval(code);
  await flush();
  return { dom, requests, writes, saved: () => clone(saved),
    close: async () => { dom.dispatchEvent(new dom.Event('pagehide')); await dom.happyDOM.abort(); } };
}

const get = (env, id) => env.dom.document.getElementById(id);
const article = (env, id) => [...get(env, 'cards').children].find((node) => node.dataset.cardId === id);
const gear = (env, id) => article(env, id).querySelector('.card-toolbar button');
const board = (env, id) => article(env, id).querySelector('transit-board-card');
const root = (env) => env.dom.document.querySelector('transit-board-card-editor').shadowRoot;
const region = (env) => root(env).querySelector('select[aria-label=Region]');
const field = (env, name) => [...root(env).querySelectorAll('label')]
  .find((label) => label.firstChild?.textContent === name)?.querySelector('input, select');
function change(env, input, value, type = 'input') {
  input.value = value;
  input.dispatchEvent(new env.dom.Event(type, { bubbles: true }));
}
async function addStation(env) {
  change(env, field(env, 'Search station'), 'Example');
  await new Promise((resolve) => setTimeout(resolve, 400));
  await flush();
  const add = [...root(env).querySelectorAll('button')].find((button) => button.textContent === 'Add stop');
  assert.equal(add.disabled, false);
  add.click();
  await flush();
}

test('VAG card creation searches, filters, saves, closes, and reopens with Nürnberg labels and attribution', async () => {
  const env = await mount([berlin]);
  try {
    const other = board(env, 'berlin');
    get(env, 'add-card').click();
    const id = get(env, 'cards').lastElementChild.dataset.cardId;
    change(env, region(env), 'vag', 'change');
    assert.equal(region(env).selectedOptions[0].textContent, 'Nürnberg / VAG network');
    assert.doesNotMatch(root(env).textContent, /Bavaria-wide/i);
    assert.doesNotMatch(env.dom.document.body.textContent, /Bavaria-wide/i);
    change(env, field(env, 'Card title (optional)'), 'Nürnberg trips');
    change(env, field(env, 'Maximum departures'), '3');
    await addStation(env);
    assert.deepEqual([...root(env).querySelectorAll('.modes label')].map((label) => label.firstChild.textContent),
      ['S-Bahn', 'Metro / U-Bahn', 'Tram', 'Bus']);
    change(env, field(env, 'Destination contains (optional)'), 'Centre');
    change(env, field(env, `Lines for ${station.name} (optional, comma separated)`), 'u1');
    for (const mode of ['S-Bahn', 'Tram', 'Bus']) {
      const input = field(env, mode);
      input.checked = false;
      input.dispatchEvent(new env.dom.Event('change', { bubbles: true }));
    }
    await flush();
    const preview = board(env, id).shadowRoot;
    assert.equal(preview.querySelectorAll('tbody tr').length, 1, 'Mode, line, and destination filters all apply.');
    assert.equal(preview.querySelector('.destination').textContent, 'Example Centre <img src=x>');
    assert.equal(preview.querySelector('img'), null);
    assert.match(preview.querySelector('.details').textContent, /13:10/);
    assert.match(preview.querySelector('.status').textContent, /Times in Nürnberg/);
    assert.equal(preview.querySelector('.heading-label').textContent, 'Nürnberg / VAG network');
    assert.equal(preview.querySelector('.source a').href, sourceUrl);
    assert.match(preview.querySelector('.source a').textContent, /VAG Nürnberg.*CC BY 4\.0/);
    assert.equal(env.writes.length, 0);
    get(env, 'save').click();
    await flush();
    assert.equal(get(env, 'settings-panel').hidden, true);
    assert.equal(env.dom.document.activeElement, gear(env, id));
    assert.deepEqual(env.saved().cards.at(-1), { id, type: 'custom:transit-board-card', provider: 'vag',
      title: 'Nürnberg trips', max_departures: 3,
      stops: [{ ...station, destination: 'Centre', lines: ['U1'], products: ['subway'] }] });
    assert.deepEqual(env.saved().cards[0], berlin);
    assert.equal(board(env, 'berlin'), other);
    gear(env, id).click();
    assert.equal(region(env).value, 'vag');
    assert.equal(field(env, 'Destination contains (optional)').value, 'Centre');
    assert.equal(field(env, `Lines for ${station.name} (optional, comma separated)`).value, 'U1');
    assert.equal(field(env, 'Metro / U-Bahn').checked, true);
    assert.equal(field(env, 'S-Bahn').checked, false);
    assert.equal(field(env, 'Tram').checked, false);
    assert.equal(field(env, 'Bus').checked, false);
    assert.equal(field(env, 'Maximum departures').value, '3');
    assert.ok(env.requests.some(({ url }) => url.includes('/haltestellen/VGN?name=Example')));
    assert.ok(env.requests.some(({ url }) => url.includes('/abfahrten/VGN/510?')));
    assert.ok(env.requests.every(({ init }) => init.credentials === 'omit'));
  } finally { await env.close(); }
});

test('changing to VAG requires fresh station selection even for overlapping numeric IDs and preserves other cards', async () => {
  const first = { ...clone(berlin), id: 'first', title: 'Keep this title', max_departures: 4,
    stops: [{ id: '510', name: 'Old Berlin station', products: ['bus'], lines: ['240'],
      direction: { id: '102', name: 'Old direction' } }] };
  const env = await mount([first, berlin]);
  try {
    const other = board(env, 'berlin');
    const otherHeading = other.shadowRoot.querySelector('h2');
    let otherUpdates = 0;
    const setConfig = other.setConfig.bind(other);
    other.setConfig = (value) => { otherUpdates += 1; setConfig(value); };
    gear(env, 'first').click();
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return false; };
    change(env, region(env), 'vag', 'change');
    assert.equal(confirmations, 1);
    assert.equal(region(env).value, 'bvg');
    assert.equal(root(env).querySelector('.stop legend').textContent, 'Old Berlin station');
    assert.equal(get(env, 'save').disabled, true);
    env.dom.confirm = () => { confirmations += 1; return true; };
    change(env, region(env), 'vag', 'change');
    assert.equal(confirmations, 2);
    assert.equal(region(env).value, 'vag');
    assert.equal(root(env).querySelectorAll('.stop').length, 0, 'Valid numeric IDs cannot transfer between regions.');
    assert.equal(field(env, 'Card title (optional)').value, 'Keep this title');
    assert.equal(field(env, 'Maximum departures').value, '4');
    await addStation(env);
    assert.equal(root(env).querySelector('.stop legend').textContent, station.name);
    assert.equal(field(env, `Lines for ${station.name} (optional, comma separated)`).value, '');
    assert.equal(field(env, 'Destination contains (optional)').value, '');
    assert.ok([...root(env).querySelectorAll('.modes input')].every((input) => input.checked));
    get(env, 'save').click();
    await flush();
    assert.deepEqual(env.saved().cards[0], { ...first, provider: 'vag', stops: [station] });
    assert.deepEqual(env.saved().cards[1], berlin);
    assert.equal(board(env, 'berlin'), other);
    assert.equal(other.shadowRoot.querySelector('h2'), otherHeading);
    assert.equal(otherUpdates, 0);
    assert.equal(get(env, 'settings-panel').hidden, true);
  } finally { await env.close(); }
});
