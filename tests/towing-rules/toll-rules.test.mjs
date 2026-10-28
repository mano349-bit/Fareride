import {test,before,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,writeBatch,serverTimestamp} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator required; never use production.');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride-tolls',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(process.env.FARERIDE_RULES_FILE || new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
 const db=context.firestore();await setDoc(doc(db,'rides','job'),{status:'started',driverId:'d',riderId:'r',fare:20,totalFare:20});
 for(const [uid,role]of [['d','driver'],['other','driver'],['r','rider']])await setDoc(doc(db,'users',uid),{role,accountStatus:'active'});
});});
after(()=>env?.cleanup());
function charge(uid='d',id='event',amount=3,aggregate=3){const db=env.authenticatedContext(uid).firestore(),batch=writeBatch(db);
 batch.set(doc(db,'rides','job','tollEvents',id),{driverId:uid,amount,location:'Bridge',source:'driver-confirmed',createdAt:serverTimestamp()});
 batch.update(doc(db,'rides','job'),{tollsAmount:aggregate,tollAccounting:'separate-v1',lastTollId:id});return batch.commit();}
test('assigned driver records atomic toll; rider can read event',async()=>{await assertSucceeds(charge());await assertSucceeds(getDoc(doc(env.authenticatedContext('r').firestore(),'rides','job','tollEvents','event')));});
test('unrelated driver and rider cannot add charges',async()=>{await assertFails(charge('other'));await assertFails(charge('r'));});
test('aggregate cannot be changed without new event or with wrong sum',async()=>{await assertFails(updateDoc(doc(env.authenticatedContext('d').firestore(),'rides','job'),{tollsAmount:10,tollAccounting:'separate-v1',lastTollId:'missing'}));await assertFails(charge('d','x',3,30));});
test('zero, negative and fractional cent tolls fail',async()=>{for(const n of [0,-1,1.001,501])await assertFails(charge('d','x',n,n));});
test('duplicate immutable event cannot be replayed',async()=>{await assertSucceeds(charge());await assertFails(charge('d','event',3,6));});
test('event cannot be written without matching ride aggregate',async()=>{const db=env.authenticatedContext('d').firestore();await assertFails(setDoc(doc(db,'rides','job','tollEvents','orphan'),{driverId:'d',amount:3,location:'Bridge',source:'driver-confirmed',createdAt:serverTimestamp()}));});
