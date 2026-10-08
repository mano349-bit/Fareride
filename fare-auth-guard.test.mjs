import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function harness() {
  let callback; const pending=[], redirects=[]; const auth={currentUser:null};
  const events={}; const notice={style:{},setAttribute(){}}; const navigator={onLine:true}; const context=vm.createContext({navigator,document:{body:{prepend(){}},createElement:()=>notice,addEventListener:(name,cb)=>events[name]=cb,visibilityState:'visible'},setTimeout:()=>1,clearTimeout(){},auth,db:{},console,window:{location:{pathname:'/rider.html',replace:path=>redirects.push(path)},addEventListener:(name,cb)=>events[name]=cb},doc:()=>({}),getDocFromServer:()=>new Promise((resolve,reject)=>pending.push(Object.assign(resolve,{reject}))),onAuthStateChanged:(_,cb)=>callback=cb});
  vm.runInContext(fs.readFileSync('fare-auth-guard.js','utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g,''),context);
  return {pending,redirects,navigator,events,notice,change(user){auth.currentUser=user;return callback(user);}};
}
test('a rider tab redirects a driver without signing out the shared account',async()=>{
  const h=harness(); const run=h.change({uid:'driver',emailVerified:true});
  h.pending.shift()({exists:()=>true,data:()=>({role:'driver',accountStatus:'approved'})});await run;
  assert.equal(h.redirects.length,1);
});
test('approved rider remains signed in without verified email',async()=>{
  const h=harness();const run=h.change({uid:'rider',emailVerified:false});
  h.pending.shift()({exists:()=>true,data:()=>({role:'rider',accountStatus:'approved'})});await run;
  assert.deepEqual(h.redirects,[]);
});
test('stale profile lookup cannot redirect a newly signed in rider',async()=>{
  const h=harness();const old=h.change({uid:'old',emailVerified:false});const current=h.change({uid:'rider',emailVerified:true});
  h.pending.shift()({exists:()=>false});await old;
  h.pending.shift()({exists:()=>true,data:()=>({role:'rider'})});await current;
  assert.deepEqual(h.redirects,[]);
});
test('missing profile does not redirect or destroy an authenticated session',async()=>{
 const h=harness();const run=h.change({uid:'rider',emailVerified:true});
 h.pending.shift()({exists:()=>false});await run;assert.deepEqual(h.redirects,[]);assert.match(h.notice.textContent,/login is retained/);
});
test('cellular failure retains login and online event retries server verification',async()=>{
 const h=harness();const run=h.change({uid:'rider',emailVerified:true});
 h.pending.shift().reject({code:'unavailable'});await run;assert.deepEqual(h.redirects,[]);
 h.events.online();assert.equal(h.pending.length,1);h.pending.shift()({exists:()=>true,data:()=>({role:'rider',accountStatus:'approved'})});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.notice.hidden,true);
});
test('offline page restore does not query server or redirect',async()=>{
 const h=harness();h.navigator.onLine=false;await h.change({uid:'rider',emailVerified:true});assert.equal(h.pending.length,0);assert.deepEqual(h.redirects,[]);
});
test('server-confirmed suspended account still cannot access protected page',async()=>{
 const h=harness();const run=h.change({uid:'rider',emailVerified:true});h.pending.shift()({exists:()=>true,data:()=>({role:'rider',accountStatus:'suspended'})});await run;assert.equal(h.redirects.length,1);
});
