import test from 'node:test';
import assert from 'node:assert/strict';
import { driverDetails, validCoordinates } from './ride-details.js';
test('driver details contain only approved public ride information', () => {
  const result = driverDetails({ uid: 'driver', status: 'approved', fullName: 'Alex', phone: '+15555550100', vehicleYear: '2024', vehicleMake: 'Toyota', vehicleModel: 'Camry', ssnLast4: '1234', documents: { private: true } }, 'driver');
  assert.deepEqual(result, { driverId: 'driver', driverName: 'Alex', driverPhone: '+15555550100', vehicleYear: '2024', vehicleMake: 'Toyota', vehicleModel: 'Camry' });
});
test('another driver or an unapproved application cannot supply ride identity', () => {
  assert.throws(() => driverDetails({ uid: 'other', status: 'approved' }, 'driver'));
  assert.throws(() => driverDetails({ uid: 'driver', status: 'suspended' }, 'driver'));
});
test('map points reject missing, nonnumeric and out-of-range coordinates', () => {
  assert.ok(validCoordinates({ lat: 40.7, lng: -74 }));
  for (const point of [null, { lat: NaN, lng: 1 }, { lat: 91, lng: 1 }, { lat: 1, lng: 181 }, { lat: '40', lng: 1 }]) assert.ok(!validCoordinates(point));
});
