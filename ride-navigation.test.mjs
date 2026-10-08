import {test} from 'node:test';import assert from 'node:assert/strict';
import {navigationLinks} from './ride-navigation.js';
test('navigation apps use pickup or destination coordinates with driving links',()=>{
 const ride={pickup:'Pickup',dropoff:'Destination',pickupLocation:{lat:40,lng:-73},dropoffLocation:{lat:41,lng:-74}};
 const pickup=navigationLinks(ride);assert.match(pickup.google,/destination=40%2C-73/);assert.match(pickup.waze,/ll=40%2C-73&navigate=yes/);assert.match(pickup.apple,/daddr=40%2C-73&dirflg=d/);
 assert.match(navigationLinks(ride,'dropoff').google,/destination=41%2C-74/);
});
test('navigation safely encodes addresses when coordinates are missing',()=>{
 const links=navigationLinks({pickup:'10022 & Main #1'});assert.match(links.waze,/q=10022%20%26%20Main%20%231/);assert.equal(navigationLinks({}),null);
});
