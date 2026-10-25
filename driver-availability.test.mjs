import test from 'node:test';
import assert from 'node:assert/strict';
import {isDriverOnline,setDriverOnline,observeDriverOnline} from './driver-availability.js';
test('availability defaults offline, broadcasts transitions, and unsubscribes cleanly',()=>{
 assert.equal(isDriverOnline(),false);const changes=[];const stop=observeDriverOnline(value=>changes.push(value));
 setDriverOnline(true);setDriverOnline(true);setDriverOnline(false);stop();setDriverOnline(true);
 assert.deepEqual(changes,[false,true,false]);setDriverOnline(false);
});
