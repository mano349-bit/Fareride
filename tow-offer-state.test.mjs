import test from 'node:test';import assert from 'node:assert/strict';
import {offerAmount,checkTowOpen,checkOfferVersion,offerResponse,acceptedTowFields} from './tow-offer-state.js';
const ride={serviceType:'tow',status:'requested',driverId:null,tipPercent:15};
const offer={driverId:'d',driverName:'Driver',driverPhone:'555',vehicleYear:2022,vehicleMake:'Ford',vehicleModel:'Truck',amount:200,counterAmount:null,status:'pending',revision:1};
test('offers and counters require positive bounded prices rounded to cents',()=>{
 assert.equal(offerAmount('123.456'),123.46);for(const value of ['',null,0,0.001,-1,NaN,Infinity,100001])assert.throws(()=>offerAmount(value));
});
test('rider can counter, decline or accept a pending driver price, but cannot accept its own counteroffer',()=>{
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


test('accepting a rider counteroffer assigns its exact price and tip',()=>{
 const counter={...offer,status:'countered',counterAmount:150,revision:2};
 assert.deepEqual(offerResponse(counter,'accept',undefined,'driver'),{status:'accepted',amount:150,revision:3});
 const fields=acceptedTowFields(ride,counter,'now','driver');assert.equal(fields.fare,150);assert.equal(fields.tipAmount,22.5);assert.equal(fields.totalFare,172.5);assert.equal(fields.driverId,'d');assert.equal(fields.status,'accepted');assert.equal(fields.pricingStatus,'agreed');
 assert.throws(()=>offerResponse(offer,'accept',undefined,'driver'));assert.throws(()=>acceptedTowFields(ride,offer,'now','driver'));
 assert.throws(()=>acceptedTowFields(ride,counter,'now','rider'));assert.throws(()=>offerResponse(counter,'counter',140,'driver'));
});
test('driver cannot accept declined/closed offers, invalid counters, or stale revisions',()=>{
 for(const status of ['pending','declined','accepted'])assert.throws(()=>offerResponse({...offer,status},'accept',undefined,'driver'));
 for(const counterAmount of [null,0,-1,NaN,Infinity,100001])assert.throws(()=>acceptedTowFields(ride,{...offer,status:'countered',counterAmount},'now','driver'));
 assert.throws(()=>acceptedTowFields({...ride,status:'accepted'},{...offer,status:'countered',counterAmount:150},'now','driver'));
 assert.throws(()=>checkOfferVersion({...offer,revision:3},{...offer,revision:2}));
});

test('driver may accept the original rider price before sending an offer or while its own different price is pending',async()=>{
 const {driverAcceptanceFields,driverOfferAmount}=await import('./tow-offer-state.js');
 const details={driverId:'d',driverName:'Driver',driverPhone:'555',vehicleYear:2022,vehicleMake:'Ford',vehicleModel:'Truck'};
 const original=driverAcceptanceFields({...ride,fare:180,pricingStatus:'estimated'},null,details,'now');assert.equal(original.ride.fare,180);assert.equal(original.offer.amount,180);assert.equal(original.offer.revision,1);assert.equal(original.ride.status,'accepted');
 const pending=driverAcceptanceFields({...ride,fare:180,pricingStatus:'estimated'},{...offer,amount:250},details,'now');assert.equal(pending.ride.fare,180);assert.equal(pending.offer.revision,2);
 assert.equal(driverOfferAmount({...ride,fare:180},{...offer,status:'countered',counterAmount:150}),150);
 assert.throws(()=>driverOfferAmount({...ride,fare:null,pricingStatus:'quote_required'},null));
 assert.throws(()=>driverAcceptanceFields({...ride,fare:180},offer,{...details,driverId:'other'},'now'));
});
