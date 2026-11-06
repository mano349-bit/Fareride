import {test,before,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator required; never use production.');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride-payments',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
 const db=context.firestore();await setDoc(doc(db,'rides','job'),{status:'completed',driverId:'d',riderId:'r',fare:20,totalFare:20,tipAmount:0,tipPercent:0,tipSubmitted:false,pricingStatus:'estimated',sandboxPaymentLock:true});
 for(const [uid,role]of [['d','driver'],['r','rider'],['a','admin']])await setDoc(doc(db,'users',uid),{role,accountStatus:'active'});
 await setDoc(doc(db,'admins','a'),{active:true});
 for(const name of ['paymentSandboxAttempts','paymentSandboxCustomers','paymentSandboxArchive'])await setDoc(doc(db,name,'secret'),{example:'server-only'});
});});
after(()=>env?.cleanup());
test('clients cannot directly read or write merchant identifiers and attempts, including admins',async()=>{
 for(const uid of ['r','d','a'])for(const name of ['paymentSandboxAttempts','paymentSandboxCustomers','paymentSandboxArchive']){const ref=doc(env.authenticatedContext(uid).firestore(),name,'secret');await assertFails(getDoc(ref));await assertFails(setDoc(ref,{paid:true}));}
});
test('rider and driver cannot forge test payment success or remove the server lock',async()=>{
 for(const uid of ['r','d']){const ref=doc(env.authenticatedContext(uid).firestore(),'rides','job');await assertFails(updateDoc(ref,{sandboxPaymentLock:false}));await assertFails(updateDoc(ref,{sandboxPayment:{status:'paid'}}));await assertFails(updateDoc(ref,{paymentStatus:'paid'}));}
});
test('checkout locks tips until the provider attempt is closed by the server',async()=>{
 const ref=doc(env.authenticatedContext('r').firestore(),'rides','job'),patch={tipSubmitted:true,tipPercent:10,tipAmount:2,totalFare:22};
 await assertFails(updateDoc(ref,patch));await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'rides','job'),{sandboxPaymentLock:false}));await assertSucceeds(updateDoc(ref,patch));
});
test('checkout locks toll entries and aggregate changes atomically',async()=>{
 const db=env.authenticatedContext('d').firestore(),batch=writeBatch(db);
 batch.set(doc(db,'rides','job','tollEvents','event'),{driverId:'d',riderId:'r',amount:3,location:'Bridge',source:'driver-rider-agreed',customerAgreed:true,createdAt:serverTimestamp()});
 batch.update(doc(db,'rides','job'),{tollsAmount:3,tollAccounting:'separate-v1',lastTollId:'event'});await assertFails(batch.commit());
});
