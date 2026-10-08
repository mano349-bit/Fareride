import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {riderTripState} from './rider-trip-state.js';
function harness(){
 const els=new Map(),listeners=[],events=[];let login;
 const el=key=>{if(!els.has(key))els.set(key,{hidden:false,style:{},querySelector:el,prepend(){}});return els.get(key);};
 const auth={currentUser:{uid:'rider'}};
 const context=vm.createContext({auth,db:{},document:{createElement:()=>el('panel'),querySelector:el},localStorage:{getItem:()=>null,setItem(){throw Error('Storage unavailable');}},window:{addEventListener(){},dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},doc:(_,collection,id)=>({collection,id}),collection:(_,name)=>name,query:(...args)=>args,where:(...args)=>args,onAuthStateChanged:(_,cb)=>login=cb,getDoc:async()=>({exists:()=>true,data:()=>({role:'rider'})}),onSnapshot:(ref,cb)=>{listeners.push({ref,cb});return()=>{};},riderTripState,riderProgress:()=>'',String});
 vm.runInContext(fs.readFileSync('rider-trip.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
 return {auth,els,listeners,events,login:()=>login(auth.currentUser)};
}
test('current rider job restores from Firebase with no local storage and survives a new login',async()=>{
 const h=harness();const job={status:'requested',riderId:'rider',pickup:'Hartford',dropoff:'West Islip',requestedAt:'2026-10-08T12:00:00Z'};
 await h.login();h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});assert.equal(h.listeners[1].ref.id,'job');h.listeners[1].cb({exists:()=>true,data:()=>job});assert.equal(h.els.get('panel').hidden,false);assert.match(h.els.get('#tripDetails').textContent,/Hartford/);assert.equal(h.events[0].detail.id,'job');
 h.auth.currentUser=null;await h.login();assert.equal(h.els.get('panel').hidden,true);h.auth.currentUser={uid:'rider'};await h.login();h.listeners[2].cb({docs:[{id:'job',data:()=>job}]});assert.equal(h.listeners[3].ref.id,'job');
});
test('old snapshots cannot show a rider job after logout',async()=>{
 const h=harness();await h.login();h.auth.currentUser=null;await h.login();h.listeners[0].cb({docs:[{id:'job',data:()=>({status:'requested'})}]});assert.equal(h.listeners.length,1);assert.equal(h.els.get('panel').hidden,true);
});
