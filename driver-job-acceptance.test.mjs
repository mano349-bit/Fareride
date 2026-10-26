import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptDriverJob,assignDriverJob} from './driver-job-acceptance.js';
const denied=()=>Object.assign(new Error('Denied'),{code:'permission-denied'});
function setup(overrides={}){
 let attempts=0,refreshes=0,profiles=0,recoveries=0;
 const options={uid:'d',currentUid:()=> 'd',readProfile:async()=>{profiles++;return {role:'driver',fullName:'Driver'};},readApplication:async()=>null,refreshSignIn:async()=>{refreshes++;},claim:async details=>{attempts++;return {status:'accepted',...details};},onRecovering:()=>recoveries++,...overrides};
 return {options,stats:()=>({attempts,refreshes,profiles,recoveries})};
}
test('one successful click claims the job without unnecessary authentication refresh',async()=>{
 const h=setup();const result=await acceptDriverJob(h.options);assert.equal(result.driverId,'d');assert.deepEqual(h.stats(),{attempts:1,refreshes:0,profiles:1,recoveries:0});
});
test('a transient permission denial refreshes sign-in and server details before one automatic retry',async()=>{
 let fresh=false;const names=[];const h=setup({readProfile:async()=>({role:'driver',fullName:fresh?'Fresh Driver':'Old Driver'}),refreshSignIn:async()=>{fresh=true;},claim:async details=>{names.push(details.driverName);if(!fresh)throw denied();return {status:'accepted',...details};}});
 const result=await acceptDriverJob(h.options);assert.deepEqual(names,['Old Driver','Fresh Driver']);assert.equal(result.driverName,'Fresh Driver');assert.equal(h.stats().recoveries,1);
});
test('expired authentication is refreshed once',async()=>{
 let calls=0;const h=setup({claim:async()=>{if(++calls===1)throw Object.assign(Error('Expired'),{code:'unauthenticated'});return {status:'accepted'};}});
 assert.equal((await acceptDriverJob(h.options)).status,'accepted');assert.equal(h.stats().refreshes,1);assert.equal(calls,2);
});
test('a persistent authorization denial remains a failure after the bounded retry',async()=>{
 let calls=0;const h=setup({claim:async()=>{calls++;throw denied();}});
 await assert.rejects(acceptDriverJob(h.options),error=>error.code==='permission-denied');assert.equal(calls,2);assert.equal(h.stats().refreshes,1);
});
test('business-rule errors are not blindly retried',async()=>{
 let calls=0;const h=setup({claim:async()=>{calls++;throw Error('Another driver claimed this job.');}});
 await assert.rejects(acceptDriverJob(h.options),/Another driver/);assert.equal(calls,1);assert.equal(h.stats().refreshes,0);
});
test('optional application permission errors do not block valid Driver claims',async()=>{
 const h=setup({readApplication:async()=>{throw denied();}});assert.equal((await acceptDriverJob(h.options)).driverName,'Driver');
});
test('a non-driver account cannot claim a job',async()=>{
 const h=setup({readProfile:async()=>({role:'rider'})});await assert.rejects(acceptDriverJob(h.options),/Driver account/);assert.equal(h.stats().attempts,0);
});
test('switching accounts during token recovery prevents a second claim',async()=>{
 let uid='d',calls=0;const h=setup({currentUid:()=>uid,claim:async()=>{calls++;throw denied();},refreshSignIn:async()=>{uid='other';}});
 await assert.rejects(acceptDriverJob(h.options),/account changed/);assert.equal(calls,1);
});
function transaction(job,{currentUid=()=> 'd'}={}){
 const writes=[];const tx={get:async()=>({exists:()=>Boolean(job),data:()=>job}),update:(reference,changes)=>writes.push({reference,changes})};
 return {writes,run:()=>assignDriverJob(tx,'ride','d',{driverId:'d',driverName:'Driver'},currentUid,'accepted-now')};
}
test('the transaction claims only an unassigned requested non-tow job',async()=>{
 const t=transaction({status:'requested',driverId:null});assert.equal((await t.run()).status,'accepted');assert.equal(t.writes.length,1);assert.equal(t.writes[0].changes.driverId,'d');
 for(const job of [null,{status:'requested',driverId:'other'},{status:'accepted',driverId:'other'},{status:'cancelled'},{status:'completed',driverId:'d'},{status:'requested',serviceType:'tow'}]){
  const rejected=transaction(job);await assert.rejects(rejected.run());assert.equal(rejected.writes.length,0);
 }
});
test('a previously committed own assignment is idempotent and preserves the live stage',async()=>{
 for(const status of ['accepted','started','arrived']){
  const t=transaction({status,driverId:'d',acceptedAt:'original'});const result=await t.run();assert.equal(result.status,status);assert.equal(result.acceptedAt,'original');assert.equal(t.writes.length,0);
 }
});
test('changing accounts while the transaction reads prevents assignment',async()=>{
 const t=transaction({status:'requested'},{currentUid:()=> 'other'});await assert.rejects(t.run(),/account changed/);assert.equal(t.writes.length,0);
});
