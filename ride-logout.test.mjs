import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('logout signs out only the page account and returns to its login without modifying rides',async()=>{
 for(const [role,page] of [['rider','rider.html'],['driver','driver.html'],['driver','driver-earnings.html']]){
  const elements=[],navItems=[];let changed,target,called=0;const auth={};
  const context=vm.createContext({auth,prepareDriverSignOut:()=>undefined,resumeDriverSession(){},signOut:async instance=>{assert.equal(instance,auth);called++;},onAuthStateChanged:(_,cb)=>changed=cb,location:{pathname:'/'+page,replace:url=>target=url},document:{getElementById:()=>page==='driver.html'?{append:(...nodes)=>navItems.push(...nodes)}:null,querySelector:()=>({append(){}}),createElement:()=>{const el={style:{},setAttribute(){}};elements.push(el);return el;}}});
  vm.runInContext(fs.readFileSync('ride-logout.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
  changed({uid:role});if(page==='driver.html')assert.equal(navItems[0],elements[0]);assert.equal(elements[0].hidden,false);await elements[0].onclick();assert.equal(called,1);assert.equal(target,role+'-login.html');
 }
});
test('logout failures show retry feedback without redirecting',async()=>{
 const elements=[];let redirected=false;
 const context=vm.createContext({auth:{},prepareDriverSignOut:()=>undefined,resumeDriverSession(){},signOut:async()=>{throw Error('failed');},onAuthStateChanged:()=>{},location:{pathname:'/rider.html',replace:()=>redirected=true},document:{querySelector:()=>({append(){}}),createElement:()=>{const el={style:{},setAttribute(){}};elements.push(el);return el;}}});
 vm.runInContext(fs.readFileSync('ride-logout.js','utf8').replace(/^import[^\n]+\n/gm,''),context);await elements[0].onclick();assert.equal(redirected,false);assert.equal(elements[0].disabled,false);assert.match(elements[1].textContent,/retry/);
});

test('driver logout waits for nearby presence cleanup before dropping authentication',async()=>{
 const elements=[];let release,called=false;const cleanup=new Promise(resolve=>{release=resolve;});
 const context=vm.createContext({auth:{},prepareDriverSignOut:()=>cleanup,resumeDriverSession(){},setTimeout:()=>1,clearTimeout(){},signOut:async()=>{called=true;},onAuthStateChanged(){},location:{pathname:'/driver.html',replace(){}},document:{querySelector:()=>({append(){}}),createElement:()=>{const el={style:{},setAttribute(){}};elements.push(el);return el;}}});
 vm.runInContext(fs.readFileSync('ride-logout.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
 const signingOut=elements[0].onclick();await Promise.resolve();assert.equal(called,false);release();await signingOut;assert.equal(called,true);
});
