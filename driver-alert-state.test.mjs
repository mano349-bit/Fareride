import test from 'node:test';import assert from 'node:assert/strict';import {newRideTracker,rideAnnouncement} from './driver-alert-state.js';
const ride=id=>({id,status:'requested',pickup:'06105',destination:'11795'});
test('initial backlog and cache snapshots do not announce old rides',()=>{const t=newRideTracker();assert.deepEqual(t.update([ride('a')],'ride',true),[]);assert.deepEqual(t.update([ride('a')],'ride'),[]);assert.deepEqual(t.update([ride('a'),ride('b')],'ride').map(r=>r.id),['b']);});
test('GPS updates, reconnection and returning jobs never duplicate alerts',()=>{const t=newRideTracker();t.update([],'ride');assert.equal(t.update([ride('a')],'ride').length,1);assert.equal(t.update([ride('a')],'ride').length,0);t.update([],'ride');assert.equal(t.update([ride('a')],'ride').length,0);});
test('all unassigned jobs in the selected queue announce, including requests needing a quote',()=>{
 const t=newRideTracker();t.update([],'ride');
 assert.deepEqual(t.update([{...ride('a'),driverId:'other'},{...ride('b'),pricingStatus:'quote_required'},{...ride('c'),serviceType:'tow'},{...ride('d'),status:'completed'}],'ride').map(job=>job.id),['b']);
 assert.equal(t.update([{...ride('b'),fare:15}],'ride').length,0);
});
test('sign out resets tracking and announcement includes full route',()=>{const t=newRideTracker();t.update([],'ride');t.update([ride('a')],'ride');t.reset();assert.equal(t.update([ride('a')],'ride').length,0);assert.equal(rideAnnouncement(ride('a')),'There is a new ride available from 06105 to 11795.');});
test('all-service alerts announce both towing quotes and bike requests once',()=>{
 const tracker=newRideTracker();tracker.update([],'all');
 const tow={...ride('tow'),serviceType:'tow',pricingStatus:'quote_required'},bike={...ride('bike'),serviceType:'messenger'};
 assert.deepEqual(tracker.update([tow,bike],'all').map(job=>job.id),['tow','bike']);
 assert.equal(tracker.update([tow,bike],'all').length,0);
 assert.match(rideAnnouncement(tow),/tow truck request/);assert.match(rideAnnouncement(bike),/bike delivery request/);
});
