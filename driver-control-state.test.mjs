import test from 'node:test';
import assert from 'node:assert/strict';
import {driverControlState} from './driver-control-state.js';
test('online without a job stays online and cannot click an empty Accept button',()=>{
 const state=driverControlState(undefined,'d',true);assert.equal(state.canAccept,false);assert.match(state.status,/^Online:/);assert.doesNotMatch(state.status,/Going online|Allow location/);
});
test('any unclaimed job is available while online, without GPS, approval or pricing prerequisites',()=>{
 for(const serviceType of ['ride','messenger','tow']){
  const state=driverControlState({status:'requested',driverId:null,serviceType,pricingStatus:'quote_required'},'d',true);
  assert.equal(state.canAccept,true);
 }
});
test('empty, assigned, finished and offline jobs cannot start a new claim',()=>{
 for(const job of [null,{status:'accepted',driverId:'other'},{status:'requested',driverId:'other'},{status:'completed'}])assert.equal(driverControlState(job,'d',true).canAccept,false);
 const job={status:'requested'};assert.equal(driverControlState(job,'d',false).canAccept,false);assert.equal(driverControlState(job,null,true).canAccept,false);assert.equal(driverControlState(job,'d',true,true).canAccept,false);
});
