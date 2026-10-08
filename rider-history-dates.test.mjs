import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDay,completedInRange} from './rider-history-dates.js';
test('inclusive local calendar range includes the entire day and sorts newest first',()=>{
 const ride=(id,date,status='completed')=>({id,status,completedAt:date});
 const rides=[ride('start',new Date(2026,9,8,0).toISOString()),ride('end',{toDate:()=>new Date(2026,9,8,23,59,59,999)}),ride('before',new Date(2026,9,7,23,59).toISOString()),ride('after',new Date(2026,9,9,0).toISOString()),ride('active',new Date(2026,9,8,12).toISOString(),'started')];
 assert.equal(localDay(new Date(2026,9,8,23)), '2026-10-08');
 assert.deepEqual(completedInRange(rides,'2026-10-08','2026-10-08').map(r=>r.id),['end','start']);
 assert.equal(completedInRange(rides,'2026-10-07','2026-10-09').length,4);
});
test('invalid or reversed calendar dates are rejected',()=>{
 for(const [start,end] of [['','2026-10-08'],['2026-02-30','2026-03-01'],['2026-10-09','2026-10-08']]) assert.equal(completedInRange([],start,end),null);
 assert.deepEqual(completedInRange([],'2026-10-08','2026-10-08'),[]);
});
