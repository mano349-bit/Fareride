import test from 'node:test';
import assert from 'node:assert/strict';
import {stageTracker} from './ride-stage-state.js';
import {gpsStageTracker,distanceMetres} from './driver-gps-stages.js';
const job={id:'j',status:'requested',driverId:null,pickupLocation:{lat:0,lng:0},dropoffLocation:{lat:0,lng:.01}};
const position=(lng,seconds,accuracy=10)=>({coords:{latitude:0,longitude:lng,accuracy},timestamp:100000+seconds*1000});
const fix=(tracker,ride,lng,seconds,accuracy=10)=>tracker.update(ride,position(lng,seconds,accuracy),100000+seconds*1000);
test('each confirmed rider stage produces one message; duplicates and regressions do not',()=>{
 const tracker=stageTracker();assert.equal(tracker.update(job),null);
 for(const status of ['accepted','started','arrived','completed']){const ride={...job,driverId:'d',status};assert.ok(tracker.update(ride));assert.equal(tracker.update(ride),null);}
 assert.equal(tracker.update({...job,status:'accepted',driverId:'d'}),null);
});
test('old rides on refresh, missing assignment, cancellation and changed drivers do not announce acceptance',()=>{
 for(const status of ['accepted','started','arrived','completed'])assert.equal(stageTracker().update({...job,status,driverId:'d'}),null);
 const tracker=stageTracker();tracker.update(job);assert.equal(tracker.update({...job,status:'accepted'}),null);
 tracker.update({...job,status:'cancelled'});assert.equal(tracker.update({...job,status:'accepted',driverId:'d'}),null);
 tracker.reset();tracker.update({...job,status:'accepted',driverId:'d'});assert.equal(tracker.update({...job,status:'started',driverId:'other'}),null);
});
test('GPS never accepts a requested job and requires real motion after acceptance',()=>{
 const tracker=gpsStageTracker();assert.equal(fix(tracker,job,0,0),null);
 const accepted={...job,status:'accepted',driverId:'d'};
 assert.equal(fix(tracker,accepted,0,0),null);assert.equal(fix(tracker,accepted,.0001,5),null);
 assert.equal(fix(tracker,accepted,.0006,12),'started');
});
test('arrival needs multiple stopped accurate fixes inside 100 metres',()=>{
 const tracker=gpsStageTracker(),ride={...job,status:'started'};
 assert.equal(fix(tracker,ride,.0001,0),null);assert.equal(fix(tracker,ride,.0001,5),null);assert.equal(fix(tracker,ride,.0001,10),null);assert.equal(fix(tracker,ride,.0001,20),'arrived');
});
test('poor, stale, duplicate and jumping GPS fixes cannot advance stages',()=>{
 const tracker=gpsStageTracker(),ride={...job,status:'started'};
 assert.equal(fix(tracker,ride,0,0,200),null);
 assert.equal(tracker.update(ride,position(0,0),200000),null);
 assert.equal(fix(tracker,ride,.01,5),null);assert.equal(fix(tracker,ride,0,6),null);
 assert.equal(fix(tracker,ride,0,6),null);assert.equal(fix(tracker,ride,0,10),null);
});
test('GPS completion requires leaving pickup and dwelling at the destination',()=>{
 const tracker=gpsStageTracker(),ride={...job,status:'arrived'};
 for(const sec of [0,5,10,30])assert.equal(fix(tracker,ride,0,sec),null);
 assert.equal(fix(tracker,ride,.003,40),null);assert.equal(fix(tracker,ride,.004,45),null);
 assert.equal(fix(tracker,ride,.01,65),null);assert.equal(fix(tracker,ride,.01,75),null);assert.equal(fix(tracker,ride,.01,85),null);assert.equal(fix(tracker,ride,.01,95),'completed');
});
test('nearby pickup and destination cannot falsely complete at pickup; missing coordinates need manual controls',()=>{
 const ride={...job,status:'arrived',dropoffLocation:{lat:0,lng:.0005}},tracker=gpsStageTracker();
 for(const sec of [0,5,10,20,30])assert.equal(fix(tracker,ride,.0005,sec),null);
 const missing=gpsStageTracker();for(const sec of [0,5,10,20,30])assert.equal(fix(missing,{...job,status:'started',pickupLocation:null},0,sec),null);
 assert.equal(distanceMetres(null,job.pickupLocation),Infinity);
});
