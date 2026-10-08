import {test} from 'node:test';import assert from 'node:assert/strict';
import {locationNotice} from './ride-location-notice.js';
test('matching device positions away from pickup explain GPS without moving the rider to the address',()=>{
 const driver={lat:40.706,lng:-73.306},pickup={lat:41.77,lng:-72.70};
 assert.match(locationNotice({driverLocation:driver,riderLocation:driver,pickupLocation:pickup}),/same GPS location/);
 assert.equal(locationNotice({driverLocation:driver,riderLocation:pickup,pickupLocation:pickup}),'');
 assert.equal(locationNotice({driverLocation:driver,riderLocation:driver,pickupLocation:driver}),'');
 assert.equal(locationNotice({driverLocation:driver}),'');
});
