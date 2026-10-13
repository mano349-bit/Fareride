import test from 'node:test';import assert from 'node:assert/strict';
import {offerAmount,checkTowOpen,checkOfferVersion,offerResponse,acceptedTowFields} from './tow-offer-state.js';
const ride={serviceType:'tow',status:'requested',driverId:null,tipPercent:15};
const offer={driverId:'d',driverName:'Driver',driverPhone:'555',vehicleYear:2022,vehicleMake:'Ford',vehicleModel:'Truck',amount:200,counterAmount:null,status:'pending',revision:1};
test('offers and counters require positive bounded prices rounded to cents',()=>{
 assert.equal(offerAmount('123.456'),123.46);for(const value of ['',null,0,0.001,-1,NaN,Infinity,100001])assert.throws(()=>offerAmount(value));
});
test('rider can counter, decline or accept a pending offer; driver must revise a counter before acceptance',()=>{
 assert.deepEqual(offerResponse(offer,'counter',150),{status:'countered',counterAmount:150,revision:2});
 assert.equal(offerResponse(offer,'decline').status,'declined');assert.equal(offerResponse(offer,'accept').status,'accepted');
 assert.throws(()=>offerResponse({...offer,status:'countered'},'accept'));assert.throws(()=>offerResponse({...offer,status:'accepted'},'decline'));
});
test('acceptance assigns the quoted driver and recalculates optional tip on the agreed price',()=>{
 const fields=acceptedTowFields(ride,offer,'now');assert.equal(fields.fare,200);assert.equal(fields.tipAmount,30);assert.equal(fields.totalFare,230);assert.equal(fields.driverId,'d');assert.equal(fields.status,'accepted');assert.equal(fields.pricingStatus,'agreed');
 assert.equal(acceptedTowFields({...ride,tipPercent:0},offer,'now').totalFare,200);
});
test('stale offers, closed jobs and other services cannot be accepted',()=>{
 assert.throws(()=>checkOfferVersion({...offer,revision:2},offer),/changed/);checkOfferVersion(null,null);
 for(const altered of [{status:'accepted'},{status:'cancelled'},{driverId:'other'},{serviceType:'ride'}])assert.throws(()=>checkTowOpen({...ride,...altered}));
 assert.throws(()=>acceptedTowFields(ride,{...offer,status:'declined'},'now'));
});
