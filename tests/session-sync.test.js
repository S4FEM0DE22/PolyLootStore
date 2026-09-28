import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionSync } from '../public/legacy/session-sync.js';

test('auth return re-reads server session and applies immediately without page reload', async () => {
  let user = null; const applied = [];
  const sync = createSessionSync(async () => ({ user }), (value, reason) => applied.push({ value, reason }));
  await sync.refresh('bootstrap');
  user = { email: 'customer@example.com' };
  await sync.refresh('auth-return');
  assert.deepEqual(applied.at(-1), { value: user, reason: 'auth-return' });
});
test('late guest response cannot overwrite a newer OAuth session', async () => {
  let finishGuest; const user = { email: 'customer@example.com' }; const applied = [];
  let count = 0;
  const sync = createSessionSync(() => ++count === 1 ? new Promise(resolve => { finishGuest = resolve; }) : Promise.resolve({ user }), value => applied.push(value));
  const initial = sync.refresh('bootstrap');
  await sync.refresh('auth-return');
  finishGuest({ user: null });
  assert.equal(await initial, false);
  assert.deepEqual(applied, [user]);
});
test('logout invalidates pending refresh so an old response cannot sign the UI back in', async () => {
  let finish; const applied = [];
  const sync = createSessionSync(() => new Promise(resolve => { finish = resolve; }), value => applied.push(value));
  const pending = sync.refresh('resume');
  sync.invalidate(); finish({ user: { email: 'customer@example.com' } });
  assert.equal(await pending, false); assert.deepEqual(applied, []);
});
test('session errors do not replace the existing account and events cannot mint a user', async () => {
  const applied = [];
  const sync = createSessionSync(async () => { throw new Error('offline'); }, user => applied.push(user));
  await assert.rejects(sync.refresh('auth-return'), /offline/);
  assert.deepEqual(applied, []);
});
