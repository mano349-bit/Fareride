import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function harness() {
  let callback; const pending=[], redirects=[]; const auth={currentUser:null};
  const context=vm.createContext({auth,db:{},console,window:{location:{pathname:'/rider.html',replace:path=>redirects.push(path)}},doc:()=>({}),getDoc:()=>new Promise(resolve=>pending.push(resolve)),onAuthStateChanged:(_,cb)=>callback=cb});
  vm.runInContext(fs.readFileSync('fare-auth-guard.js','utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g,''),context);
  return {pending,redirects,change(user){auth.currentUser=user;return callback(user);}};
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
