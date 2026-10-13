import {test} from 'node:test';import assert from 'node:assert/strict';import {latestCurrentRide} from './ride-recovery.js';
test('restoration chooses latest own unfinished ride with ISO or Firebase timestamps',()=>{
 const base={riderId:'r',driverId:'d',status:'accepted'};
 const rides=[{...base,id:'old',requestedAt:'2026-10-07T10:00:00Z'},{...base,id:'new',requestedAt:{toMillis:()=>Date.parse('2026-10-08T10:00:00Z')}},{...base,id:'finished',status:'completed',requestedAt:'2026-10-09T10:00:00Z'},{...base,id:'other',riderId:'other',driverId:'other',requestedAt:'2026-10-10T10:00:00Z'}];
 assert.equal(latestCurrentRide(rides,'r','rider').id,'new');assert.equal(latestCurrentRide(rides,'d','driver').id,'new');assert.equal(latestCurrentRide(rides,'unknown','rider'),null);
 const pending={...base,id:'pending',status:'requested',requestedAt:'2026-10-09T10:00:00Z'};
 assert.equal(latestCurrentRide([...rides,pending],'r','rider').id,'new');assert.equal(latestCurrentRide([...rides,pending],'d','driver').id,'new');
});

test('rider focuses a newly accepted job even with newer waiting tow or bike requests',()=>{
 const rides=[{id:'accepted',riderId:'r',status:'accepted',driverId:'d',requestedAt:'2026-10-12T10:00:00Z'}, {id:'waiting',riderId:'r',status:'requested',requestedAt:'2026-10-13T10:00:00Z'}];
 assert.equal(latestCurrentRide(rides,'r','rider').id,'accepted');
 assert.equal(latestCurrentRide([{...rides[0],status:'completed'},rides[1]],'r','rider').id,'waiting');
});
