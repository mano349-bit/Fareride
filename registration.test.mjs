import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { registrationErrorMessage } from './registration-errors.js';

function harness(options = {}) {
  const elements = new Map(), records = new Map();
  const user = { uid: 'test-uid', emailVerified: false };
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: id === 'ssnLast4' ? '0000' : id.includes('Password') ? 'example-password' : 'Example', files: [{ name: 'test.pdf', size: 10, type: 'application/pdf' }], textContent: '', disabled: false, classList: { add() {}, remove() {} }, addEventListener() {}, reset() {} });
    return elements.get(id);
  };
  if (options.profile) records.set('users/test-uid', options.profile);
  const context = vm.createContext({ registrationErrorMessage, console: { log() {}, error() {} }, Date, Math, URL,
    window: { location: { href: 'https://mano349-bit.github.io/Fareride/registration.html' } },
    document: { getElementById: el }, auth: {}, db: {}, storage: {},
    doc: (_, collection, id) => `${collection}/${id}`, ref: (_, path) => path,
    getDoc: async path => ({ exists: () => records.has(path), data: () => records.get(path) }),
    setDoc: async (path, data) => { if (options.databaseError) throw Object.assign(new Error('Denied'), { code: 'permission-denied' }); records.set(path, { ...records.get(path), ...data }); },
    createUserWithEmailAndPassword: async () => ({ user }), signInWithEmailAndPassword: async () => ({ user }),
    uploadBytes: async () => { if (options.uploadError) throw Object.assign(new Error('Denied'), { code: 'storage/unauthorized' }); },
    sendEmailVerification: async (_, settings) => { context.returnUrl = settings.url; if (options.emailError) throw Object.assign(new Error('Domain'), { code: 'auth/unauthorized-continue-uri' }); }
  });
  const source = fs.readFileSync(new URL('./registration.js', import.meta.url), 'utf8').replace(/^\uFEFF/, '').replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { el, records, context, submit: role => vm.runInContext(role === 'driver' ? 'submitDriver({preventDefault(){}})' : 'submitRider({preventDefault(){}})', context) };
}

for (const role of ['rider', 'driver']) {
  test(`${role} application survives verification email failure and uses the live role login URL`, async () => {
    const h = harness({ emailError: true });
    await h.submit(role);
    assert.equal(h.records.get(`users/test-uid`).accountStatus, 'pending');
    assert.equal(h.records.get(`${role}Applications/${role}_test-uid`).status, 'new');
    assert.equal(h.context.returnUrl, `https://mano349-bit.github.io/Fareride/${role}-login.html`);
    assert.match(h.el(role === 'rider' ? 'riderApplicationMessage' : 'applicationMessage').textContent, /verification email delivery failed/);
  });
  test(`${role} upload failure exposes its step and code without claiming success`, async () => {
    const h = harness({ uploadError: true });
    await h.submit(role);
    assert.match(h.el(role === 'rider' ? 'riderApplicationMessage' : 'applicationMessage').textContent, /storage\/unauthorized/);
    assert.equal(h.records.has(`${role}Applications/${role}_test-uid`), false);
    assert.equal(h.el(role === 'rider' ? 'submitRiderBtn' : 'submitApplicationBtn').disabled, false);
  });
}
test('registration cannot change the role of an existing account', async () => {
  const h = harness({ profile: { role: 'driver', accountStatus: 'suspended' } });
  await h.submit('rider');
  assert.equal(h.records.get('users/test-uid').role, 'driver');
  assert.equal(h.records.get('users/test-uid').accountStatus, 'suspended');
  assert.match(h.el('riderApplicationMessage').textContent, /driver account/);
});
test('retry preserves existing approval state', async () => {
  const h = harness({ profile: { role: 'driver', accountStatus: 'approved', approved: true } });
  await h.submit('driver');
  assert.equal(h.records.get('users/test-uid').accountStatus, 'approved');
  assert.equal(h.records.get('users/test-uid').approved, true);
});
test('database failure is distinguished from an upload failure', async () => {
  const h = harness({ databaseError: true });
  await h.submit('rider');
  assert.match(h.el('riderApplicationMessage').textContent, /saving your account profile; code: permission-denied/);
});
