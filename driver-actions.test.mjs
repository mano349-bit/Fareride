import test from 'node:test';
import assert from 'node:assert/strict';
import { actionButtons } from './driver-actions.js';
for (const [status, expected] of [['requested', 'acceptRide'], ['accepted', 'startRide'], ['started', 'arrivedRide'], ['arrived', 'completeRide']]) {
  test(`${status} enables only the next permitted action`, () => {
    const html = actionButtons({ id: 'job', status, driverId: status === 'requested' ? null : 'driver' }, 'driver');
    const buttons = [...html.matchAll(/<button[^>]+>/g)].map(match => match[0]);
    assert.equal(buttons.length, 4);
    const enabled = buttons.filter(button => !button.includes('disabled'));
    assert.equal(enabled.length, 1);
    assert.ok(enabled[0].includes(expected));
  });
}
test('another driver, completed jobs and unpriced quotes have no enabled actions', () => {
  for (const ride of [{ status: 'accepted', driverId: 'other' }, { status: 'completed', driverId: 'driver' }, { status: 'requested', driverId: null, pricingStatus: 'quote_required' }]) {
    assert.equal((actionButtons({ id: 'job', ...ride }, 'driver').match(/ disabled/g) || []).length, 4);
  }
});


test('buttons follow Accept, Start, Arrive, Complete order', () => {
  const html = actionButtons({ id: 'job', status: 'requested' }, 'driver');
  const labels = [...html.matchAll(/>([^<]+)<\/button>/g)].map(match => match[1]);
  assert.deepEqual(labels, ['+ Accept Job', 'Start Ride', 'Arrive at Pickup', 'Complete Ride']);
});
