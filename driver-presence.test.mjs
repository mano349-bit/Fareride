import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {claimDriverDetails} from './driver-claim.js';
import {nearestDrivers} from './nearby-drivers-state.js';
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function setup(options={}){
 const nodes=[],events={},writes=[];let authChanged,locationChanged,jobs,online=false,record=null,fail=false;
 const element=tag=>{const node={tag,style:{},textContent:'',setAttribute(){},append(){}};nodes.push(node);return node;};
 const auth={currentUser:{uid:'d'}};
 const context={console,Date,Promise,auth,claimDriverDetails,db:{},navigator:{onLine:true},
  document:{createElement:element,querySelector:()=>({prepend(){}}),getElementById:id=>id==='providerService'?{value:'ride',addEventListener(){}}:null},
  window:{addEventListener:(name,callback)=>{events[name]=callback;}},setInterval:()=>1,clearInterval(){},
  registerDriverSessionLifecycle:(leave,resume)=>{context.leave=leave;context.resume=resume;},setDriverOnline:value=>{online=value;},observeSessionLocation:callback=>{locationChanged=callback;callback({uid:'d',position:null,error:null});return ()=>{};},
  validCoordinates:p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng),ACTIVE_STATUSES:['accepted','arrived','started'],
  doc:(_db,...path)=>path.join('/'),collection(){},query(){},where(){},serverTimestamp:()=>new Date().toISOString(),
  getDoc:async ref=>({exists:()=>!options.missingApp||ref.startsWith('users/'),data:()=>ref.startsWith('users/')?{role:'driver',accountStatus:options.pending?'pending':'approved',fullName:'Test'}:{status:'approved',fullName:'Test',vehicleYear:2020,vehicleMake:'A',vehicleModel:'B'}}),
  setDoc:async(ref,value)=>{writes.push(value.available);if(fail){fail=false;throw new Error('network');}record=value;},deleteDoc:async()=>{record=null;},
  onAuthStateChanged:(_auth,callback)=>{authChanged=callback;},onSnapshot:(_query,callback)=>{jobs=callback;callback({docs:[]});return ()=>{};}
 };
 vm.runInNewContext(fs.readFileSync('driver-presence.js','utf8').replace(/^import .*;\n/gm,''),context);
 return {nodes,writes,context,events,get online(){return online;},get record(){return record;},start:()=>authChanged(auth.currentUser),logout:async()=>{auth.currentUser=null;await authChanged(null);},position:()=>locationChanged({uid:'d',position:{timestamp:Date.now(),coords:{latitude:40,longitude:-73}}}),error:()=>locationChanged({uid:'d',error:{code:1}}),jobs:list=>jobs({docs:list.map(job=>({data:()=>job}))}),fail:()=>{fail=true;}};
}
test('signed-in drivers automatically become online with no online/offline button',async()=>{
 const h=setup();await h.start();await flush();assert.equal(h.online,true);assert.equal(h.nodes.some(node=>node.tag==='button'),false);assert.match(h.nodes[2].textContent,/^Online:/);
 h.position();await flush();assert.equal(h.record.available,true);assert.equal(nearestDrivers([{...h.record,id:'d'}],{lat:40,lng:-73}).length,1);
 await h.logout();assert.equal(h.online,false);assert.match(h.nodes[2].textContent,/Signed out/);
});
test('GPS permission and presence-write failures never turn a signed-in driver offline',async()=>{
 const h=setup();await h.start();h.position();await flush();h.error();await flush();assert.equal(h.online,true);assert.equal(h.record.available,false);
 h.fail();h.position();await flush();assert.equal(h.online,true);assert.match(h.nodes[2].textContent,/^Online:/);
});
test('current trips hide nearby availability without disabling online job queues',async()=>{
 const h=setup();await h.start();h.position();await flush();h.jobs([{status:'started'}]);await flush();assert.equal(h.record.available,false);assert.equal(h.online,true);
});
test('all Driver profiles become online even if the application is missing or pending',async()=>{
 const h=setup({missingApp:true,pending:true});await h.start();assert.equal(h.online,true);
});
test('a connection loss keeps the signed-in state but explicitly reports lost connectivity',async()=>{
 const h=setup();await h.start();h.context.navigator.onLine=false;h.events.offline();assert.equal(h.online,true);assert.match(h.nodes[2].textContent,/Connection lost/);
 h.context.navigator.onLine=true;h.events.online();await flush();assert.equal(h.online,true);
});

test('logout waits for pending presence writes then removes nearby availability',async()=>{
 const h=setup();await h.start();h.position();await flush();assert.equal(h.record.available,true);
 await h.context.leave();assert.equal(h.record,null);assert.equal(h.online,false);
 await h.context.resume();assert.equal(h.online,true);
});
