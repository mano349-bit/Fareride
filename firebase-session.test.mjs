import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function initialize(localAvailable=true){
 const selected=[];
 const local={name:'local',available:async()=>localAvailable};const session={name:'session',available:async()=>true};
 const indexedDB={name:'indexedDB',available:()=>new Promise(()=>{})};
 const context=vm.createContext({console,location:{pathname:'/rider-login.html'},authScope:()=> 'rider',initializeApp:(_,name)=>({name}),getFirestore:()=>({}),getStorage:()=>({}),browserLocalPersistence:local,browserSessionPersistence:session,indexedDBLocalPersistence:indexedDB,
 initializeAuth:(_,options)=>({ready:Promise.all(options.persistence.map(async p=>{if(await p.available())selected.push(p.name);})),options})});
 let source=fs.readFileSync('firebase-config.js','utf8').replace(/import[\s\S]*?from\s*["'][^"']+["'];/g,'').replace(/export\s*\{[\s\S]*?\};/g,'');
 vm.runInContext(source+'\nglobalThis.testAuth = auth;',context);
 return {auth:context.testAuth,selected};
}
test('auth initializes even when Safari IndexedDB never responds',async()=>{
 const h=initialize();await h.auth.ready;assert.deepEqual(h.selected,['local','session']);assert.equal(h.auth.options.persistence.length,2);
});
test('auth retains session storage fallback when local storage is blocked',async()=>{
 const h=initialize(false);await h.auth.ready;assert.deepEqual(h.selected,['session']);
});
