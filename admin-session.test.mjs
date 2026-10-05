import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness() {
  const pending = [], access = [], auth = { currentUser: null };
  let listener;
  const context = vm.createContext({ auth, db: {}, console,
    doc: (_, collection, uid) => `${collection}/${uid}`,
    getDoc: () => new Promise(resolve => pending.push(resolve)),
    onAuthStateChanged: (_, callback) => { listener = callback; return () => {}; }
  });
  const source = fs.readFileSync(new URL('./admin-session.js', import.meta.url), 'utf8')
    .replace(/^import[^\n]+\n/, '').replace('export function', 'function');
  vm.runInContext(source, context);
  context.observeAdmin(approved => access.push(approved));
  return { pending, access, change(user) { auth.currentUser = user; return listener(user); } };
}
test('admin access is revoked immediately when registration changes the account', async () => {
  const h = harness();
  const first = h.change({ uid: 'admin' });
  h.pending.shift()({ exists: () => true, data: () => ({ active: true }) });
  await first;
  const second = h.change({ uid: 'rider' });
  assert.equal(h.access.at(-1), false);
  h.pending.shift()({ exists: () => false });
  await second;
  assert.equal(h.access.at(-1), false);
});
test('a delayed admin lookup cannot restore access after sign-out', async () => {
  const h = harness();
  const first = h.change({ uid: 'admin' });
  await h.change(null);
  h.pending.shift()({ exists: () => true, data: () => ({ active: true }) });
  await first;
  assert.equal(h.access.includes(true), false);
});
