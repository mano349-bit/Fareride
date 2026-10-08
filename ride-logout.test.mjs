import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('logout signs out only the page account and returns to its login without modifying rides',async()=>{
 for(const role of ['rider','driver']){
  const elements=[];let changed,target,called=0;const auth={};
  const context=vm.createContext({auth,signOut:async instance=>{assert.equal(instance,auth);called++;},onAuthStateChanged:(_,cb)=>changed=cb,location:{pathname:'/'+role+'.html',replace:url=>target=url},document:{querySelector:()=>({append(){}}),createElement:()=>{const el={style:{},setAttribute(){}};elements.push(el);return el;}}});
  vm.runInContext(fs.readFileSync('ride-logout.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
  changed({uid:role});assert.equal(elements[0].hidden,false);await elements[0].onclick();assert.equal(called,1);assert.equal(target,role+'-login.html');
 }
});
test('logout failures show retry feedback without redirecting',async()=>{
 const elements=[];let redirected=false;
 const context=vm.createContext({auth:{},signOut:async()=>{throw Error('failed');},onAuthStateChanged:()=>{},location:{pathname:'/rider.html',replace:()=>redirected=true},document:{querySelector:()=>({append(){}}),createElement:()=>{const el={style:{},setAttribute(){}};elements.push(el);return el;}}});
 vm.runInContext(fs.readFileSync('ride-logout.js','utf8').replace(/^import[^\n]+\n/gm,''),context);await elements[0].onclick();assert.equal(redirected,false);assert.equal(elements[0].disabled,false);assert.match(elements[1].textContent,/retry/);
});
