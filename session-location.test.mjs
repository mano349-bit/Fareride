import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(role='driver'){
 const watches=[],events={},page={},timers=[],cleared=[],signals=[];let changed,permissionChanged;
 const auth={currentUser:null};
 const ctx={auth,console,location:{pathname:'/'+role+'.html'},CustomEvent:class {constructor(name,args){this.type=name;this.detail=args.detail;}},
  window:{addEventListener:(name,cb)=>events[name]=cb,dispatchEvent:event=>signals.push(event)},document:{hidden:false,addEventListener:(name,cb)=>page[name]=cb},
  setTimeout:cb=>{timers.push(cb);return timers.length;},clearTimeout(){},onAuthStateChanged:(_,callback)=>changed=callback,
  navigator:{geolocation:{watchPosition:(ok,fail)=>{watches.push({ok,fail});return watches.length;},clearWatch:id=>cleared.push(id)},permissions:{query:async()=>({addEventListener:(_,cb)=>permissionChanged=cb})}}
 };
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('session-location.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,''),ctx);
 const values=[];const stop=ctx.observeSessionLocation(state=>values.push(state));
 return {ctx,auth,watches,events,page,timers,cleared,signals,values,stop,login:()=>{auth.currentUser={uid:'u'};changed();},logout:()=>{auth.currentUser=null;changed();},permission:()=>permissionChanged(),position:watch=>watches[watch].ok({coords:{latitude:40,longitude:-73},timestamp:Date.now()})};
}
test('one automatic GPS watch serves multiple subscribers and stops on logout',()=>{
 const h=setup();h.login();const extra=[];h.ctx.observeSessionLocation(state=>extra.push(state));assert.equal(h.watches.length,1);
 h.position(0);assert.equal(h.values.at(-1).position.coords.latitude,40);assert.equal(extra.at(-1).position.coords.latitude,40);
 h.logout();assert.equal(h.values.at(-1).uid,null);assert.ok(h.cleared.includes(1));h.position(0);assert.equal(h.values.at(-1).uid,null);
});
test('rider GPS starts before a trip and emits only the signed-in rider position',()=>{
 const h=setup('rider');h.login();h.position(0);assert.equal(h.signals[0].type,'fareride-rider-position');assert.equal(h.signals[0].detail.lat,40);
});
test('transient GPS failures retry automatically and permission changes resume without a toggle',async()=>{
 const h=setup();h.login();await Promise.resolve();await Promise.resolve();h.watches[0].fail({code:2});assert.equal(h.values.at(-1).error.code,2);h.timers[0]();assert.equal(h.watches.length,2);
 h.watches[1].fail({code:1});assert.equal(h.timers.length,1);h.permission();assert.equal(h.watches.length,3);h.position(2);assert.equal(h.values.at(-1).error,null);
});
test('page return and reconnection restart sharing, but stale watches cannot publish',()=>{
 const h=setup();h.login();h.events.pagehide();h.position(0);assert.equal(h.values.at(-1).position,null);h.events.pageshow();assert.equal(h.watches.length,2);
 h.events.online();assert.equal(h.watches.length,3);h.page.visibilitychange();assert.equal(h.watches.length,4);h.position(3);assert.ok(h.values.at(-1).position);
});
