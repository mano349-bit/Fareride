import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewToll} from './toll-review.js';
import {riderTotal} from './toll-accounting.js';
const ride={driverId:'d',riderId:'r',status:'completed',fare:100,totalFare:110,tipAmount:10};
const claim={driverId:'d',amount:5,location:'Bridge',source:'driver-submitted',status:'pending'};
test('pending toll does not alter ride total; approval adds toll once',()=>{
 assert.equal(riderTotal(ride),110);
 const approved=reviewToll(ride,claim,'admin','approved','event');
 assert.equal(riderTotal({...ride,...approved.ridePatch}),115);
 assert.equal(approved.review.status,'approved');assert.equal(approved.review.reviewedBy,'admin');
});
test('rejection does not alter ride or charges',()=>{
 assert.equal(reviewToll(ride,claim,'admin','rejected','event').ridePatch,null);
 assert.equal(riderTotal(ride),110);
});
test('reviewed toll cannot be applied again',()=>{
 for(const status of ['approved','rejected'])assert.equal(reviewToll(ride,{...claim,status},'admin','approved','event'),null);
});
test('invalid ownership, amount, decision and signed-out review fail',()=>{
 assert.throws(()=>reviewToll(ride,{...claim,driverId:'other'},'admin','approved','event'));
 assert.throws(()=>reviewToll(ride,{...claim,amount:-2},'admin','approved','event'));
 assert.throws(()=>reviewToll(ride,claim,null,'approved','event'));
 assert.throws(()=>reviewToll(ride,claim,'admin','invalid','event'));
});
