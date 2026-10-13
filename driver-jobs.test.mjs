import test from 'node:test';import assert from 'node:assert/strict';
import {visibleDriverJobs} from './driver-jobs.js';
const jobs=[{id:'ride',status:'requested',serviceType:'ride'},{id:'tow',status:'requested',serviceType:'tow',pricingStatus:'estimated'},{id:'tow-quote',status:'requested',serviceType:'tow',pricingStatus:'quote_required'},{id:'bike',status:'requested',serviceType:'messenger'},{id:'bike-quote',status:'requested',serviceType:'messenger',pricingStatus:'quote_required'},{id:'own',status:'accepted',driverId:'d'},{id:'other',status:'accepted',driverId:'other'},{id:'done',status:'completed',driverId:'d'}];
test('default driver list includes passenger, tow and bike requests including quotes',()=>{
 assert.deepEqual(visibleDriverJobs(jobs,'d').map(j=>j.id),['ride','tow','tow-quote','bike','bike-quote','own']);
});
test('service filters retain own active jobs and exclude other drivers and completed work',()=>{
 assert.deepEqual(visibleDriverJobs(jobs,'d','tow').map(j=>j.id),['tow','tow-quote','own']);
 assert.deepEqual(visibleDriverJobs(jobs,'d','messenger').map(j=>j.id),['bike','bike-quote','own']);
});
test('an already assigned requested job is not offered to other drivers',()=>{
 assert.equal(visibleDriverJobs([{id:'claimed',status:'requested',driverId:'other',serviceType:'tow'}],'d').length,0);
 assert.equal(visibleDriverJobs([{id:'legacy',status:'requested'}],'d','ride').length,1);
});
