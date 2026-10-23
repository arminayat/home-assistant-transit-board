import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Window } from 'happy-dom';

const html = await readFile('dist/public/index.html', 'utf8');
const code = await readFile('dist/public/app.js', 'utf8');
const now = Date.parse('2026-01-15T12:00:00Z');
const when = new Date(now + 10 * 60_000).toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0)); };
const stops = {
  bvg: { id: '101', name: 'Berlin Example' },
  entur: { id: 'NSR:StopPlace:202', name: 'Oslo Example' },
  'transport-ch': { id: '303', name: 'Swiss Example' },
};
const card = (provider, title = provider) => ({ id: provider, type: 'custom:transit-board-card', provider, title,
  stops: [clone(stops[provider])], max_departures: 5 });
const json = (body, headers = {}) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', ...headers } });

function providerResponse(url) {
  if (url.startsWith('https://v6.bvg.transport.rest/')) {
    return json(url.includes('/locations?') ? [{ ...stops.bvg, type: 'stop' }] : { departures: [{
      tripId: 'bvg-trip', stop: stops.bvg, line: { name: 'U5', product: 'subway' },
      direction: 'Berlin Centre', plannedWhen: when, when, delay: 0,
    }] });
  }
  if (url.startsWith('https://api.entur.io/geocoder/')) {
    return json({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {
      id: stops.entur.id, layer: 'stopPlace', names: { default: stops.entur.name, display: stops.entur.name },
    } }] });
  }
  if (url.startsWith('https://api.entur.io/journey-planner/')) {
    return json({ data: { stopPlace: { ...stops.entur, estimatedCalls: [{
      realtime: true, aimedDepartureTime: when, expectedDepartureTime: when,
      actualDepartureTime: null, cancellation: false, forBoarding: true,
      destinationDisplay: { frontText: 'Oslo Centre <img src=x>' },
      quay: { id: 'NSR:Quay:202', name: stops.entur.name, publicCode: '2' },
      serviceJourney: { id: 'RUT:ServiceJourney:202', line: {
        id: 'RUT:Line:11', publicCode: '11', name: 'Route 11', transportMode: 'tram',
      } },
    }] } } });
  }
  if (url.startsWith('https://transport.opendata.ch/')) {
    return json(url.includes('/locations?') ? { stations: [stops['transport-ch']] } : { stationboard: [{
      name: 'swiss-trip', category: 'S', number: '5', operator: 'SBB', to: 'Swiss Centre',
      stop: { station: stops['transport-ch'], departureTimestamp: Date.parse(when) / 1_000,
        platform: '3', prognosis: { departure: when } },
    }] });
  }
  throw new Error(`Unexpected provider request: ${url}`);
}

async function mount(cards, route) {
  const dom = new Window({ url: 'https://example.invalid/api/hassio_ingress/regions/' });
  let saved = { cards: clone(cards) };
  let revision = 1;
  const writes = [];
  const requests = [];
  dom.Date.now = () => now;
  dom.document.write(html.replace(/<script[^>]*><\/script>/, ''));
  dom.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'api/config') {
      if (init?.method === 'PUT') {
        writes.push({ body: JSON.parse(init.body), init });
        assert.equal(init.headers['If-Match'], `"${revision}"`);
        saved = JSON.parse(init.body);
        revision += 1;
      }
      return json(saved, { ETag: `"${revision}"` });
    }
    requests.push({ url, init });
    return await route?.(url, init) ?? providerResponse(url);
  };
  dom.eval(code);
  await flush();
  return { dom, writes, requests, saved: () => clone(saved),
    close: async () => { dom.dispatchEvent(new dom.Event('pagehide')); await dom.happyDOM.abort(); } };
}

const get = (env, id) => env.dom.document.getElementById(id);
const article = (env, id) => [...get(env, 'cards').children].find((node) => node.dataset.cardId === id);
const gear = (env, id) => article(env, id).querySelector('.card-toolbar button');
const board = (env, id) => article(env, id).querySelector('transit-board-card');
const editor = (env) => env.dom.document.querySelector('transit-board-card-editor');
const region = (env) => editor(env).shadowRoot.querySelector('select[aria-label=Region]');
const field = (env, name) => [...editor(env).shadowRoot.querySelectorAll('label')]
  .find((label) => label.firstChild?.textContent === name)?.querySelector('input, select');
function change(env, input, value, type = 'input') {
  input.value = value;
  input.dispatchEvent(new env.dom.Event(type, { bubbles: true }));
}
async function addStation(env) {
  change(env, field(env, 'Search station'), 'Example');
  await new Promise((resolve) => setTimeout(resolve, 400));
  await flush();
  const add = [...editor(env).shadowRoot.querySelectorAll('button')].find((button) => button.textContent === 'Add stop');
  assert.equal(add.disabled, false);
  add.click();
  await flush();
}

test('mixed regions independently fetch their providers and display local times, source links, and safe labels', async () => {
  const env = await mount([card('bvg'), card('entur'), card('transport-ch')]);
  try {
    const expected = [
      ['bvg', 'Berlin Centre', 'Berlin', 'https://v6.bvg.transport.rest/'],
      ['entur', 'Oslo Centre <img src=x>', 'Oslo', 'https://developer.entur.no/docs/open-services'],
      ['transport-ch', 'Swiss Centre', 'Zürich', 'https://transport.opendata.ch/'],
    ];
    for (const [id, destination, city, sourceUrl] of expected) {
      const root = board(env, id).shadowRoot;
      assert.equal(root.querySelector('.destination').textContent, destination);
      assert.match(root.querySelector('.details').textContent, /13:10/);
      assert.match(root.querySelector('.status').textContent, new RegExp(`Times in ${city}`));
      assert.equal(root.querySelector('.source a').href, sourceUrl);
      assert.equal(root.querySelector('.source a').rel, 'noopener noreferrer');
      assert.equal(root.querySelector('img'), null);
    }
    assert.ok(env.requests.some(({ url }) => url.includes('v6.bvg.transport.rest/stops/101/departures')));
    assert.ok(env.requests.some(({ url, init }) => url.includes('api.entur.io/journey-planner/') && init.method === 'POST'));
    assert.ok(env.requests.some(({ url }) => url.includes('transport.opendata.ch/v1/stationboard')));
    assert.ok(env.requests.every(({ init }) => init.credentials === 'omit'));
  } finally { await env.close(); }
});

test('changing Region confirms clearing stops and filters, preserves card settings, and resets invalid form state', async () => {
  const original = card('bvg', 'Morning');
  original.max_departures = 8;
  original.stops[0] = { ...original.stops[0], products: ['bus'], lines: ['240'], direction: { id: '102', name: 'Example Destination' } };
  const env = await mount([original, card('transport-ch')]);
  try {
    const other = board(env, 'transport-ch');
    gear(env, 'bvg').click();
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return false; };
    change(env, region(env), 'entur', 'change');
    assert.equal(confirmations, 1);
    assert.equal(region(env).value, 'bvg');
    assert.equal(editor(env).shadowRoot.querySelectorAll('.stop').length, 1);
    assert.equal(get(env, 'save').disabled, true);
    change(env, field(env, 'Maximum departures'), '0');
    assert.equal(get(env, 'error').hidden, false);
    env.dom.confirm = () => { confirmations += 1; return true; };
    change(env, region(env), 'entur', 'change');
    assert.equal(confirmations, 2);
    assert.equal(region(env).value, 'entur');
    assert.equal(field(env, 'Card title (optional)').value, 'Morning');
    assert.equal(field(env, 'Maximum departures').value, '8');
    assert.equal(editor(env).shadowRoot.querySelectorAll('.stop').length, 0);
    assert.equal(get(env, 'error').hidden, true);
    assert.equal(get(env, 'save').disabled, false);
    assert.equal(board(env, 'transport-ch'), other);
    get(env, 'save').click();
    await flush();
    assert.equal(get(env, 'settings-panel').hidden, true);
    assert.equal(env.dom.document.activeElement, gear(env, 'bvg'));
    assert.deepEqual(env.saved().cards[0], { ...original, provider: 'entur', stops: [] });
    gear(env, 'bvg').click();
    assert.equal(region(env).value, 'entur');
    assert.equal(field(env, 'Maximum departures').value, '8');
    assert.equal(editor(env).shadowRoot.querySelectorAll('.stop').length, 0);
  } finally { await env.close(); }
});

test('foreign destination and mode controls persist through Save and reopening, while BVG keeps direction search', async () => {
  const env = await mount([card('bvg'), card('entur'), card('transport-ch')]);
  try {
    gear(env, 'bvg').click();
    assert.ok(field(env, `Direction for ${stops.bvg.name}`));
    assert.equal(field(env, 'Destination contains (optional)'), undefined);
    assert.equal(editor(env).shadowRoot.querySelectorAll('.modes input').length, 7);
    get(env, 'cancel').click();
    for (const provider of ['entur', 'transport-ch']) {
      gear(env, provider).click();
      const root = editor(env).shadowRoot;
      assert.equal(root.querySelectorAll('.modes input').length, provider === 'entur' ? 6 : 5);
      const modeLabels = root.querySelector('.modes').textContent;
      assert.match(modeLabels, /Train.*Tram.*Bus.*Ferry.*Cable/);
      assert.equal(modeLabels.includes('Metro'), provider === 'entur');
      assert.equal([...root.querySelectorAll('button')].some((button) => button.textContent === 'Set direction'), false);
      const destination = field(env, 'Destination contains (optional)');
      assert.match(root.getElementById(destination.getAttribute('aria-describedby')).textContent, /displayed destination, not stations along the route/);
      change(env, destination, 'Centre');
      change(env, field(env, `Lines for ${stops[provider].name} (optional, comma separated)`), provider === 'entur' ? '11' : 's5');
      get(env, 'save').click();
      await flush();
      assert.equal(get(env, 'settings-panel').hidden, true);
      const saved = env.saved().cards.find((entry) => entry.provider === provider);
      assert.equal(saved.stops[0].destination, 'Centre');
      assert.deepEqual(saved.stops[0].lines, [provider === 'entur' ? '11' : 'S5']);
      assert.equal(saved.stops[0].direction, undefined);
      gear(env, provider).click();
      assert.equal(field(env, 'Destination contains (optional)').value, 'Centre');
      get(env, 'cancel').click();
    }
  } finally { await env.close(); }
});

test('new cards search the chosen Region and persist provider-specific station IDs', async () => {
  const env = await mount([]);
  try {
    let confirmations = 0;
    env.dom.confirm = () => { confirmations += 1; return true; };
    for (const provider of ['bvg', 'entur', 'transport-ch']) {
      get(env, 'add-card').click();
      change(env, region(env), provider, 'change');
      change(env, field(env, 'Card title (optional)'), `New ${provider}`);
      await addStation(env);
      get(env, 'save').click();
      await flush();
      const saved = env.saved().cards.at(-1);
      assert.equal(saved.provider, provider);
      assert.deepEqual(saved.stops, [stops[provider]]);
      assert.equal(get(env, 'settings-panel').hidden, true);
    }
    assert.equal(confirmations, 0, 'Changing the Region of an empty card needs no removal confirmation.');
    assert.ok(env.requests.some(({ url }) => url.includes('api.entur.io/geocoder/v3/autocomplete?')));
    assert.ok(env.requests.some(({ url }) => url.includes('transport.opendata.ch/v1/locations?')));
  } finally { await env.close(); }
});

test('changing Region disposes an outstanding station search before its old results arrive', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const env = await mount([], (url) => url.includes('v6.bvg.transport.rest/locations?') ? pending : undefined);
  try {
    get(env, 'add-card').click();
    change(env, field(env, 'Search station'), 'Example');
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.ok(env.requests.some(({ url }) => url.includes('v6.bvg.transport.rest/locations?')));
    change(env, region(env), 'entur', 'change');
    finish(json([{ ...stops.bvg, type: 'stop' }]));
    await flush();
    assert.equal(region(env).value, 'entur');
    assert.equal(editor(env).shadowRoot.querySelector('.search button').disabled, true);
    assert.equal(editor(env).shadowRoot.querySelectorAll('.search option').length, 0);
    await addStation(env);
    get(env, 'save').click();
    await flush();
    assert.deepEqual(env.saved().cards[0].stops, [stops.entur]);
  } finally { finish(json([])); await env.close(); }
});
