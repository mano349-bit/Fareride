import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {nearestDrivers} from './nearby-drivers-state.js';
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function setup() {
 const nodes=[];
 const element=()=>{const node={style:{},disabled:false,textContent:'',setAttribute(){},append(){}};nodes.push(node);return node;};
 let authChanged,gps,error,online=false,release;
 const writes=[];let record=null,delay=false,fail=false;
 const auth={currentUser:{uid:'d'}};
 const context={console,Date,Promise,auth,db:{},
  document:{createElement:element,querySelector:()=>({prepend(){}}),getElementById:()=>({value:'ride',addEventListener(){}})},
  window:{addEventListener(){}},navigator:{geolocation:{watchPosition(ok,fail){gps=ok;error=fail;return 1;},clearWatch(){}}},
  setInterval:()=>1,clearInterval(){},
  setDriverOnline:value=>{online=value;},isDriverOnline:()=>online,
  validCoordinates:p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng),ACTIVE_STATUSES:['accepted','arrived','started'],
  doc:(_db,...path)=>path.join('/'),collection(){},query(){},where(){},serverTimestamp:()=>new Date().toISOString(),
  getDoc:async ref=>({exists:()=>true,data:()=>ref.startsWith('users/')?{role:'driver',accountStatus:'approved'}:{status:'approved',fullName:'Test',vehicleYear:2020,vehicleMake:'A',vehicleModel:'B'}}),
  setDoc:async(ref,value)=>{writes.push(value.available);if(fail){fail=false;throw new Error('network');}if(delay){delay=false;await new Promise(resolve=>{release=resolve;});}record=value;},
  deleteDoc:async()=>{record=null;},
  onAuthStateChanged:(_auth,callback)=>{authChanged=callback;},
  onSnapshot:(_query,callback)=>{callback({docs:[]});return ()=>{};}
 };
 vm.runInNewContext(fs.readFileSync('driver-presence.js','utf8').replace(/^import .*;\n/gm,''),context);
 return {nodes,writes,get online(){return online;},get record(){return record;},start:()=>authChanged(auth.currentUser),position:()=>gps({timestamp:Date.now(),coords:{latitude:40,longitude:-73}}),fail:()=>{fail=true;},delay:()=>{delay=true;},release:()=>release(),error:()=>error()};
}
test('new sessions start offline; first GPS fix confirms availability; offline hides driver and stops jobs',async()=>{
 const ctx=setup();await ctx.start();assert.equal(ctx.online,false);assert.equal(ctx.record,null);
 const button=ctx.nodes[2];button.onclick();assert.equal(ctx.online,false);
 ctx.position();await flush();assert.equal(ctx.online,true);assert.equal(ctx.record.available,true);
 assert.equal(nearestDrivers([{...ctx.record,id:'d'}],{lat:40,lng:-73}).length,1);
 button.onclick();assert.equal(ctx.online,false);await flush();assert.equal(ctx.record.available,false);
 assert.equal(nearestDrivers([{...ctx.record,id:'d'}],{lat:40,lng:-73}).length,0);
});
test('offline write follows an in-flight online write and cannot be overwritten by stale GPS',async()=>{
 const ctx=setup();await ctx.start();const button=ctx.nodes[2];button.onclick();ctx.delay();ctx.position();await flush();
 button.onclick();ctx.position();assert.equal(ctx.online,false);ctx.release();await flush();
 assert.deepEqual(ctx.writes,[true,false]);assert.equal(ctx.record.available,false);assert.equal(ctx.online,false);
});
test('GPS failure returns online drivers to offline and removes rider visibility',async()=>{
 const ctx=setup();await ctx.start();const button=ctx.nodes[2];button.onclick();ctx.position();await flush();
 ctx.error();await flush();assert.equal(ctx.online,false);assert.equal(ctx.record.available,false);
});

test('failed offline write stays paused and offers a retry until removal is confirmed',async()=>{
 const ctx=setup();await ctx.start();const button=ctx.nodes[2];button.onclick();ctx.position();await flush();
 ctx.fail();button.onclick();await flush();assert.equal(ctx.online,false);assert.equal(ctx.record.available,true);
 assert.equal(button.textContent,'Retry go offline');assert.match(ctx.nodes[3].textContent,/not confirmed/);
 button.onclick();await flush();assert.equal(ctx.record.available,false);assert.equal(button.textContent,'Go online');
});
