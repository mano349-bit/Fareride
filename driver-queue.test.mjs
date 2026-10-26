import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {visibleDriverJobs} from './driver-jobs.js';
test('offline unsubscribes the new-job queue, ignores late snapshots, and retains assigned jobs',()=>{
 let online=false,change,message='Going online. Allow location access.';const subscriptions=[],alerts=[],renders=[];
 const context={Map,Date,Boolean,console,DRIVER_ID:'d',rides:[],auth:{currentUser:{uid:'d'}},
  db:{},collection(){},where:(field,_op,value)=>({field,value}),query:(_collection,condition)=>condition,
  liveSnapshot:(q,_options,callback)=>{const sub={q,callback,stopped:false};subscriptions.push(sub);return ()=>{sub.stopped=true;};},
  observeDriverOnline:callback=>{change=callback;callback(online);return ()=>{change=null;};},
  isDriverOnline:()=>online,jobFilter:()=> 'all',notifyNewRides:rides=>alerts.push(rides),resetRideAlerts:()=>{alerts.length=0;},
  saveLocalBackup(){},setActiveDriverRide(){},clearActiveDriverRide(){},setDriverMessage:value=>{message=value;},
  window:{dispatchEvent(){}},Event:class{},
  renderRequests:()=>renders.push(Array.from(visibleDriverJobs(context.rides,'d','all',online),job=>job.id))
 };
 const source=fs.readFileSync('driver.js','utf8');
 vm.runInNewContext(source.slice(source.indexOf('function startRideListener()'),source.indexOf('let stopRides = null;')),context);
 const stop=context.startRideListener();assert.equal(subscriptions.length,1);assert.equal(subscriptions[0].q.field,'driverId');
 const snapshot=jobs=>({docs:jobs.map(job=>({id:job.id,data:()=>job})),metadata:{fromCache:false}});
 subscriptions[0].callback(snapshot([{id:'own',driverId:'d',status:'started'}]));
 online=true;change(true);assert.match(message,/^Online:/);assert.doesNotMatch(message,/Going online|Allow location/);const requests=subscriptions[1];
 requests.callback(snapshot([{id:'new',status:'requested'}]));assert.deepEqual(renders.at(-1),['new','own']);
 online=false;change(false);assert.equal(requests.stopped,true);assert.deepEqual(renders.at(-1),['own']);assert.equal(alerts.length,0);
 requests.callback(snapshot([{id:'late',status:'requested'}]));assert.deepEqual(renders.at(-1),['own']);assert.equal(alerts.length,0);
 online=true;change(true);requests.callback(snapshot([{id:'stale',status:'requested'}]));assert.deepEqual(renders.at(-1),['own']);
 subscriptions[2].callback(snapshot([{id:'fresh',status:'requested'}]));assert.deepEqual(renders.at(-1),['fresh','own']);
 stop();assert.equal(subscriptions[0].stopped,true);assert.equal(subscriptions[2].stopped,true);
});
