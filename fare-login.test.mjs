import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
for(const role of ['rider','driver'])test(role+' login preserves authenticated session when cellular profile lookup fails',async()=>{
 const elements={};let signouts=0;const auth={};
 const context=vm.createContext({withDeadline:operation=>operation,URL,console,auth,db:{},window:{location:{href:'https://example.com/'+role+'-login.html'}},document:{body:{dataset:{role}},getElementById:id=>elements[id]??={value:id==='email'?'test@example.com':'private',style:{},addEventListener(){}}},doc:()=>({}),getDocFromServer:async()=>{throw {code:'unavailable',message:'Connection interrupted; retry sign in when connected.'};},signInWithEmailAndPassword:async()=>({user:{uid:'test'}}),signOut:async()=>signouts++,sendEmailVerification(){},sendPasswordResetEmail(){}});
 vm.runInContext(fs.readFileSync('fare-login.js','utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];/g,''),context);
 await vm.runInContext('login()',context);assert.equal(signouts,0);assert.match(elements.message.textContent,/sign-in is saved/);assert.equal(elements.loginButton.disabled,false);
});
