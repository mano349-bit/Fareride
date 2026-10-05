import test from 'node:test';
import assert from 'node:assert/strict';
import { riderTripState } from './rider-trip-state.js';
test('riders can cancel before the trip starts, but not during or after the trip', () => {
  for (const status of ['requested', 'accepted', 'arrived']) assert.equal(riderTripState({ status }).canCancel, true);
  for (const status of ['started', 'completed', 'cancelled']) assert.equal(riderTripState({ status }).canCancel, false);
});
test('completed and cancelled trips allow a new request', () => {
  for (const status of ['completed', 'cancelled']) assert.equal(riderTripState({ status }).finished, true);
  assert.equal(riderTripState({ status: 'accepted' }).finished, false);
});
test('quote requests explain dispatch rather than implying an accepted ride', () => {
  assert.match(riderTripState({ status: 'requested', pricingStatus: 'quote_required' }).message, /dispatch/);
});
