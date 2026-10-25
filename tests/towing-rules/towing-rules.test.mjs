import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,writeBatch,serverTimestamp,Timestamp} from 'firebase/firestore';
import {offerResponse,acceptedTowFields} from '../../tow-offer-state.js';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Run with firebase emulators:exec. No production access is supported.');
let env;
const baseRide={id:'tow',serviceType:'tow',riderId:'r',riderName:'Rider',riderPhone:'555',status:'requested',driverId:null,driverName:null,driverLocation:null,fare:200,tipPercent:15,tipAmount:30,totalFare:230,pricingStatus:'estimated',pickup:'Pickup',dropoff:'Shop',acceptedAt:null,requestedAt:'2026-10-25T12:00:00Z'};
const driverFields={driverId:'d',driverName:'Driver',driverPhone:'5551234567',vehicleYear:2022,vehicleMake:'Ford',vehicleModel:'F150'};
const pending={...driverFields,amount:200,counterAmount:null,status:'pending',revision:1};
const counter={...pending,counterAmount:150,status:'countered',revision:2};
const db=uid=>env.authenticatedContext(uid).firestore();
async function seed(offer=counter,extra={}){
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const store=context.firestore();
  for(const [uid,role] of [['r','rider'],['r2','rider'],['d','driver'],['d2','driver']])await setDoc(doc(store,'users',uid),{uid,role,accountStatus:'approved'});
  for(const uid of ['d','d2']){
   await setDoc(doc(store,'driverApplications','driver_'+uid),{...driverFields,uid,status:'approved',fullName:'Driver',phone:'5551234567'});
   await setDoc(doc(store,'driverPresence',uid),{available:true,updatedAt:Timestamp.fromMillis(Date.now()-1000)});
  }
  await setDoc(doc(store,'rides','tow'),{...baseRide,...extra});
  if(offer)await setDoc(doc(store,'rides','tow','towOffers',offer.driverId),{...offer,updatedAt:Timestamp.now()});
 });
}
function acceptance(uid,offer,actor,overrideRide={},overrideOffer={}){
 const store=db(uid),batch=writeBatch(store);
 batch.update(doc(store,'rides','tow'),{...acceptedTowFields(baseRide,offer,new Date().toISOString(),actor),...overrideRide});
 batch.update(doc(store,'rides','tow','towOffers',offer.driverId),{...offerResponse(offer,'accept',undefined,actor),updatedAt:serverTimestamp(),...overrideOffer});
 return batch.commit();
}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(()=>seed());after(async()=>env?.cleanup());

test('driver accepts the rider counteroffer atomically at its exact price',async()=>{
 await assertSucceeds(acceptance('d',counter,'driver'));
 const ride=(await getDoc(doc(db('d'),'rides','tow'))).data(),offer=(await getDoc(doc(db('d'),'rides','tow','towOffers','d'))).data();
 assert.equal(ride.status,'accepted');assert.equal(ride.fare,150);assert.equal(ride.tipAmount,22.5);assert.equal(ride.totalFare,172.5);assert.equal(ride.driverId,'d');assert.equal(offer.amount,150);assert.equal(offer.status,'accepted');assert.equal(offer.counterAmount,150);
});
test('rider can still accept a pending driver offer',async()=>{await seed(pending);await assertSucceeds(acceptance('r',pending,'rider'));assert.equal((await getDoc(doc(db('r'),'rides','tow'))).data().fare,200);});
test('driver cannot accept its own pending price without rider agreement',async()=>{await seed(pending);await assertFails(acceptance('d',pending,'rider'));});
test('rider cannot accept its own counteroffer on behalf of the driver',async()=>{await assertFails(acceptance('r',counter,'driver'));});
test('another driver or unrelated rider cannot accept this counteroffer',async()=>{await assertFails(acceptance('d2',counter,'driver'));await assertFails(acceptance('r2',counter,'driver'));});
test('the accepted offer and assignment must be written together',async()=>{
 await assertFails(updateDoc(doc(db('d'),'rides','tow','towOffers','d'),{...offerResponse(counter,'accept',undefined,'driver'),updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(db('d'),'rides','tow'),acceptedTowFields(baseRide,counter,new Date().toISOString(),'driver')));
});
test('driver cannot change the agreed counter price, tip, vehicle or counter amount',async()=>{
 await assertFails(acceptance('d',counter,'driver',{fare:151}));
 await assertFails(acceptance('d',counter,'driver',{tipAmount:100,totalFare:250}));
 await assertFails(acceptance('d',counter,'driver',{vehicleModel:'Other'}));
 await assertFails(acceptance('d',counter,'driver',{}, {counterAmount:140}));
});
test('stale revisions and changed rider counteroffers are rejected',async()=>{
 await assertFails(acceptance('d',counter,'driver',{}, {revision:2}));
 await seed({...counter,counterAmount:160,revision:3});await assertFails(acceptance('d',counter,'driver'));
});
test('offline and suspended drivers cannot accept',async()=>{
 await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'driverPresence','d'),{available:false}));await assertFails(acceptance('d',counter,'driver'));
 await seed();await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'users','d'),{accountStatus:'suspended'}));await assertFails(acceptance('d',counter,'driver'));
});
test('a cancelled or assigned tow cannot be accepted',async()=>{await seed(counter,{status:'cancelled'});await assertFails(acceptance('d',counter,'driver'));await seed(counter,{status:'accepted',driverId:'d2'});await assertFails(acceptance('d',counter,'driver'));});
test('drivers cannot bypass towing negotiation through regular Accept Job',async()=>{await seed(null);await assertFails(updateDoc(doc(db('d'),'rides','tow'),{status:'accepted',...driverFields,acceptedAt:new Date().toISOString()}));});
test('an accepted tow follows the normal driver lifecycle; wrong actors and skipped stages fail',async()=>{
 await assertSucceeds(acceptance('d',counter,'driver'));
 await assertFails(updateDoc(doc(db('r'),'rides','tow'),{status:'started',startedAt:'now'}));
 await assertFails(updateDoc(doc(db('d2'),'rides','tow'),{status:'started',startedAt:'now'}));
 await assertFails(updateDoc(doc(db('d'),'rides','tow'),{status:'completed',completedAt:'now'}));
 await assertSucceeds(updateDoc(doc(db('d'),'rides','tow'),{status:'started',startedAt:'now',estimatedFinishAt:'later'}));
 await assertSucceeds(updateDoc(doc(db('d'),'rides','tow'),{status:'arrived',arrivedAt:'now'}));
 await assertSucceeds(updateDoc(doc(db('d'),'rides','tow'),{status:'completed',completedAt:'now'}));
});
test('competing acceptances cannot assign the tow to two drivers',async()=>{
 const other={...counter,driverId:'d2'};
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'rides','tow','towOffers','d2'),{...other,updatedAt:Timestamp.now()}));
 const results=await Promise.allSettled([acceptance('d',counter,'driver'),acceptance('d2',other,'driver')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const stored=(await getDoc(doc(db('r'),'rides','tow'))).data();assert.ok(['d','d2'].includes(stored.driverId));
});
