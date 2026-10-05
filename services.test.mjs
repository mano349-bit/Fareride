import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as services from './services.js';

test('legacy bookings remain passenger rides and service queues are separate', () => {
  assert.equal(services.matchesService({}, 'ride'), true);
  assert.equal(services.matchesService({ serviceType: 'tow' }, 'ride'), false);
  assert.equal(services.matchesService({ serviceType: 'messenger' }, 'messenger'), true);
});
test('service details are required, trimmed and bounded', () => {
  assert.throws(() => services.validateServiceDetails('tow', { vehicle: 'Car' }));
  assert.throws(() => services.validateServiceDetails('messenger', { packageDescription: 'Box' }));
  assert.throws(() => services.validateServiceDetails('other'));
  assert.throws(() => services.validateServiceDetails('tow', { vehicle: 'x'.repeat(501), issue: 'Flat' }));
  assert.deepEqual(services.validateServiceDetails('tow', { vehicle: ' Sedan ', issue: ' Flat ' }), { vehicle: 'Sedan', issue: 'Flat' });
  assert.equal(services.priceLabel({ pricingStatus: 'quote_required', fare: null }, () => '$0'), 'Quote required');
});

function riderHarness(fail = false) {
  const elements = new Map(), storage = new Map(), writes = [];
  let type = 'ride';
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: false, disabled: false, textContent: '', addEventListener(name, fn) { this[name] = fn; }, closest() { return el(id + 'Label'); } });
    return elements.get(id);
  };
  el('rideType').value = 'economy';
  const context = vm.createContext({ ...services, crypto: { randomUUID: () => 'unique' }, console: { log() {}, error() {}, warn() {} },
    document: { getElementById: el, querySelector: () => ({ value: type }), querySelectorAll: () => [] },
    window: { addEventListener() {}, dispatchEvent() {} }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    auth: { currentUser: { uid: 'rider-uid', displayName: 'Test Rider' } }, db: {}, doc: (...args) => args,
    setDoc: async (_, job) => { if (fail) throw new Error('Offline'); writes.push(job); },
    onSnapshot: () => () => {}, Event: class Event { constructor(type) { this.type = type; } }, Date, Intl, URL, setTimeout, clearTimeout, AbortController });
  const source = fs.readFileSync(new URL('./rider.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  return { el, context, writes, storage, select(value) { type = value; vm.runInContext('updateService()', context); } };
}
test('towing quote stores authenticated identity and never invents a fare or arrival time', async () => {
  const h = riderHarness();
  h.select('tow');
  h.el('pickup').value = 'Vehicle location'; h.el('dropoff').value = 'Repair shop';
  h.el('towVehicle').value = 'Sedan'; h.el('towIssue').value = 'Flat tire';
  await h.el('estimateBtn').onclick();
  assert.equal(h.el('requestBtn').disabled, false);
  await h.el('rideForm').onsubmit({ preventDefault() {} });
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].serviceType, 'tow');
  assert.equal(h.writes[0].riderId, 'rider-uid');
  assert.equal(h.writes[0].fare, null);
  assert.equal(h.writes[0].estimatedArrivalAt, null);
  assert.equal(h.el('fare').textContent, 'Quote required');
});
test('edited details invalidate estimates and failed submissions leave no saved request', async () => {
  const h = riderHarness(true);
  h.select('messenger');
  h.el('pickup').value = 'Office'; h.el('dropoff').value = 'Recipient office';
  h.el('packageDescription').value = 'Envelope'; h.el('recipientName').value = 'Recipient';
  await h.el('estimateBtn').onclick();
  h.el('rideForm').input();
  assert.equal(h.el('requestBtn').disabled, true);
  await h.el('estimateBtn').onclick();
  await h.el('rideForm').onsubmit({ preventDefault() {} });
  assert.equal(h.storage.has('fareride_last_ride_id'), false);
  assert.equal(h.storage.has('fareride_rides_v2'), false);
  assert.equal(h.el('msg').textContent, 'Request was not sent. Check your connection and try again.');
  assert.equal(h.el('requestBtn').disabled, false);
});
