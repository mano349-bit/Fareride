import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as services from './services.js';
import * as towPricing from './tow-pricing.js';

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
  assert.deepEqual(services.validateServiceDetails('tow', { vehicle: ' Sedan ', issue: ' Flat ' }), { vehicle: 'Sedan', issue: 'Flat', vehicleClass: 'light' });
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
  const context = vm.createContext({ ...services, ...towPricing, CustomEvent: class {constructor(type,options){this.type=type;this.detail=options?.detail;}}, crypto: { randomUUID: () => 'unique' }, console: { log() {}, error() {}, warn() {} },
    createVehiclePicker: () => ({description: () => el('towVehicle').value, setActive() {}}),
    document: { getElementById: el, querySelector: () => ({ value: type }), querySelectorAll: () => [] },
    window: { addEventListener() {}, dispatchEvent() {} }, localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    auth: { currentUser: { uid: 'rider-uid', displayName: 'Test Rider' } }, db: {}, doc: (...args) => args, getDoc: async () => ({exists:()=>true,data:()=>({fullName:'Test Rider',phone:'(516) 376-4118'})}),
    setDoc: async (_, job) => { if (fail) throw new Error('Offline'); writes.push(job); },
    liveSnapshot: () => () => {}, Event: class Event { constructor(type) { this.type = type; } }, Date, Intl, URL, setTimeout, clearTimeout, AbortController });
  const source = fs.readFileSync(new URL('./rider.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '');
  vm.runInContext(source, context);
  vm.runInContext('geocode=async()=>({lat:40,lon:-73});getRoute=async()=>({distance:1609.344*10,duration:600});',context);
  return { el, context, writes, storage, select(value) { type = value; vm.runInContext('updateService()', context); } };
}
test('specialty towing stays a quote with authenticated identity and no invented fare or arrival time', async () => {
  const h = riderHarness();
  h.el('towVehicleClass').value = 'specialty';
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
  h.select('tow');
  h.el('pickup').value = 'Office'; h.el('dropoff').value = 'Recipient office';
  h.el('towVehicle').value = 'Sedan'; h.el('towIssue').value = 'Flat tire';
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

test('bike delivery uses economy pricing even after selecting XL', async()=>{
 const h=riderHarness();h.select('messenger');h.el('rideType').value='xl';h.el('pickup').value='A';h.el('dropoff').value='B';h.el('packageDescription').value='Envelope';h.el('recipientName').value='Sam';
 vm.runInContext('geocode=async()=>({lat:40,lon:-73});getRoute=async()=>({distance:1609.344*10,duration:600});',h.context);
 await h.el('estimateBtn').onclick();await h.el('rideForm').onsubmit({preventDefault(){}});
 assert.equal(h.writes[0].fare,26);assert.equal(h.writes[0].serviceType,'messenger');assert.equal(h.writes[0].pricingStatus,'estimated');assert.equal(h.writes[0].riderPhone,'(516) 376-4118');
});

test('standard towing calculates route-based pricing independently of passenger XL rates and saves optional tips',async()=>{
 const h=riderHarness();h.el('towVehicleClass').value='light';h.select('tow');h.el('rideType').value='xl';
 h.el('pickup').value='Pickup';h.el('dropoff').value='Shop';h.el('towVehicle').value='Honda Civic';h.el('towIssue').value='No start';h.el('tipChoice').value='15';
 await h.el('estimateBtn').onclick();
 assert.equal(h.el('fare').textContent,'Estimated $172.00');assert.match(h.el('towEstimateBreakdown').textContent,/112.00 hookup/);
 await h.el('rideForm').onsubmit({preventDefault(){}});
 const ride=h.writes[0];assert.equal(ride.fare,172);assert.equal(ride.miles,10);assert.equal(ride.rideType,'tow');assert.equal(ride.pricingStatus,'estimated');
 assert.equal(ride.tipAmount,25.8);assert.equal(ride.totalFare,197.8);assert.equal(ride.estimatedArrivalAt,null);assert.equal(ride.serviceDetails.vehicleClass,'light');
});
test('a failed tow route or missing vehicle details cannot submit an estimate',async()=>{
 const h=riderHarness();h.select('tow');h.el('pickup').value='A';h.el('dropoff').value='B';
 await h.el('estimateBtn').onclick();assert.equal(h.el('requestBtn').disabled,true);
 h.el('towVehicle').value='Sedan';h.el('towIssue').value='No start';vm.runInContext("getRoute=async()=>{throw new Error('No route found')}",h.context);
 await h.el('estimateBtn').onclick();assert.equal(h.el('requestBtn').disabled,true);assert.equal(h.writes.length,0);assert.equal(h.el('msg').textContent,'No route found');
});

test('long-distance passenger routes retain full mileage duration and fare without a distance cap',async()=>{
 const h=riderHarness();h.el('pickup').value='10022';h.el('dropoff').value='33160';
 vm.runInContext('getRoute=async()=>({distance:2080000,duration:75600})',h.context);
 await h.el('estimateBtn').onclick();assert.equal(h.el('requestBtn').disabled,false);
 await h.el('requestBtn').onclick();const ride=h.writes[0];assert.equal(ride.durationMinutes,1260);assert.equal(ride.miles,Number((2080000/1609.344).toFixed(2)));assert.equal(ride.fare,Number((3.5+2080000/1609.344*2.25).toFixed(2)));assert.equal(ride.pickup,'10022');assert.equal(ride.dropoff,'33160');
});
