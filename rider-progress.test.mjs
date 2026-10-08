import test from 'node:test';
import assert from 'node:assert/strict';
import {riderProgress} from './rider-progress.js';
test('all rider progress steps are disabled and follow the driver sequence',()=>{
 const html=riderProgress('started');
 assert.equal((html.match(/ disabled/g)||[]).length,4);
 assert.deepEqual([...html.matchAll(/>(Accept Job|Start Ride|Arrive at Pickup|Complete Ride)</g)].map(m=>m[1]),['Accept Job','Start Ride','Arrive at Pickup','Complete Ride']);
 assert.match(html,/Start Ride: Done/);assert.match(html,/Arrive at Pickup: Waiting/);
});
test('progress tracks every stage and never shows a cancelled job as completed',()=>{
 for(const [status,count] of [['requested',0],['accepted',1],['started',2],['arrived',3],['completed',4],['cancelled',0]]){
  const html=riderProgress(status);assert.equal((html.match(/: Done/g)||[]).length,count);
 }
});
