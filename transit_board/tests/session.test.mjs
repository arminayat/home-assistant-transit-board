import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoardSession } from '../dist/session.js';

const config = (title = 'Home') => ({ type: 'custom:transit-board-card', title, stops: [], max_departures: 5 });
const snapshot = (title = 'Home', etag = '"1"') => ({ config: config(title), etag });
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const session = (read, write) => new BoardSession(() => {}, read, write);

test('first load, preview, explicit save and cancel keep a shared saved revision', async () => {
  const calls = [];
  const state = session(async () => snapshot(), async (value, etag) => {
    calls.push({ value, etag }); return { config: value, etag: '"2"' };
  });
  await state.refresh();
  assert.equal(state.dirty, false);
  state.edit(config('Work'));
  assert.equal(state.saved.config.title, 'Home');
  assert.equal(state.dirty, true);
  assert.equal(calls.length, 0);
  await state.save();
  assert.equal(calls[0].etag, '"1"');
  assert.equal(state.saved.config.title, 'Work');
  assert.equal(state.dirty, false);
  state.edit(config('Draft'));
  state.cancel();
  assert.equal(state.draft.title, 'Work');
  assert.equal(state.dirty, false);
});

test('remote updates apply to a clean board and preserve dirty drafts', async () => {
  let remote = snapshot();
  const state = session(async () => remote);
  await state.refresh();
  remote = snapshot('Office', '"2"');
  await state.refresh();
  assert.equal(state.draft.title, 'Office');
  state.edit(config('My draft'));
  remote = snapshot('Someone else', '"3"');
  await state.refresh();
  assert.equal(state.saved.etag, '"2"');
  assert.equal(state.draft.title, 'My draft');
  assert.equal(state.remote.etag, '"3"');
  state.cancel();
  assert.equal(state.draft.title, 'Someone else');
});

test('edits made during a save remain unsaved after the submitted snapshot succeeds', async () => {
  const pending = deferred();
  let submitted;
  const state = session(async () => snapshot(), async (value) => { submitted = value; return pending.promise; });
  await state.refresh();
  state.edit(config('Submitted'));
  const saving = state.save();
  state.edit(config('Still typing'));
  pending.resolve({ config: submitted, etag: '"2"' });
  await saving;
  assert.equal(state.saved.config.title, 'Submitted');
  assert.equal(state.draft.title, 'Still typing');
  assert.equal(state.dirty, true);
  assert.match(state.notice, /more unsaved/);
});

test('a remote change reverted to the saved revision cannot block saving or replace a draft', async () => {
  let remote = snapshot();
  const state = session(async () => remote);
  await state.refresh();
  state.edit(config('My draft'));
  remote = snapshot('Temporary remote', '"2"');
  await state.refresh();
  assert.equal(state.remote.etag, '"2"');
  remote = snapshot();
  await state.refresh();
  assert.equal(state.remote, undefined);
  assert.equal(state.draft.title, 'My draft');
  state.cancel();
  assert.equal(state.draft.title, 'Home');
});

test('a stale background read cannot roll back a successful save', async () => {
  const oldRead = deferred();
  let reads = 0;
  const state = session(() => ++reads === 1 ? Promise.resolve(snapshot()) : oldRead.promise,
    async (value) => ({ config: value, etag: '"2"' }));
  await state.refresh();
  const refreshing = state.refresh();
  state.edit(config('New board'));
  await state.save();
  oldRead.resolve(snapshot());
  await refreshing;
  assert.equal(state.saved.etag, '"2"');
  assert.equal(state.draft.title, 'New board');
});

test('typing while an explicit reload is in flight preserves the new draft', async () => {
  const pending = deferred();
  let reads = 0;
  const state = session(() => ++reads === 1 ? Promise.resolve(snapshot()) : pending.promise);
  await state.refresh();
  state.edit(config('Old draft'));
  const loading = state.reload();
  state.edit(config('New draft'));
  pending.resolve(snapshot('Remote', '"2"'));
  await loading;
  assert.equal(state.draft.title, 'New draft');
  assert.equal(state.saved.etag, '"1"');
});

test('failed and conflicting saves preserve the submitted draft and revision', async () => {
  const state = session(async () => snapshot(), async () => { throw new Error('Changed elsewhere'); });
  await state.refresh();
  state.edit(config('Keep me'));
  await state.save();
  assert.equal(state.draft.title, 'Keep me');
  assert.equal(state.saved.etag, '"1"');
  assert.equal(state.saving, false);
  assert.match(state.error, /elsewhere/);
});

test('an ambiguous save can be reconciled when the server holds the exact draft', async () => {
  let remote = snapshot();
  const state = session(async () => remote, async (value) => {
    remote = { config: value, etag: '"2"' }; throw new Error('Connection lost after write');
  });
  await state.refresh();
  state.edit(config('Saved despite disconnect'));
  await state.save();
  assert.equal(state.dirty, true);
  await state.refresh();
  assert.equal(state.dirty, false);
  assert.equal(state.saved.etag, '"2"');
  assert.equal(state.error, '');
});

test('validation blocks a save without dropping the last valid preview', async () => {
  let writes = 0;
  const state = session(async () => snapshot(), async () => { writes++; return snapshot(); });
  await state.refresh();
  state.edit({ ...config(), stops: Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: 'Stop' })) });
  assert.match(state.validationError, /20 stops/);
  assert.equal(state.draft.stops.length, 0);
  await state.save();
  assert.equal(writes, 0);
  state.edit(config('Valid again'));
  assert.equal(state.validationError, '');
});

test('unreadable saved settings are shown as an error and can be retried', async () => {
  let failed = true;
  const state = session(async () => { if (failed) throw new Error('Restore backup'); return snapshot(); });
  await state.refresh();
  assert.equal(state.saved, undefined);
  assert.match(state.error, /backup/);
  failed = false;
  await state.refresh();
  assert.equal(state.saved.etag, '"1"');
  assert.equal(state.error, '');
});
