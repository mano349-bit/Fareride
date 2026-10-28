import {test,before,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,writeBatch,serverTimestamp,collectionGroup,getDocs} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator required; never use production.');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride-tolls',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(process.env.FARERIDE_RULES_FILE || new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
 const db=context.firestore();await setDoc(doc(db,'rides','job'),{status:'started',driverId:'d',riderId:'r',fare:20,totalFare:20});
 for(const [uid,role]of [['d','driver'],['other','driver'],['r','rider']])await setDoc(doc(db,'users',uid),{role,accountStatus:'active'});
 await setDoc(doc(db,'admins','admin'),{active:true});await setDoc(doc(db,'admins','inactive'),{active:false});
});});
after(()=>env?.cleanup());
const db=uid=>env.authenticatedContext(uid).firestore();
const claim=(uid='d',amount=3,status='pending')=>({driverId:uid,amount,location:'Bridge',source:'driver-submitted',status,createdAt:serverTimestamp()});
const ref=(uid,id='event')=>doc(db(uid),'rides','job','tollEvents',id);
test('driver can submit pending claim without changing rider total',async()=>{await assertSucceeds(setDoc(ref('d'),claim()));const ride=await assertSucceeds(getDoc(doc(db('r'),'rides','job')));if(ride.data().totalFare!==20)throw Error('Pending toll changed total');});
test('driver cannot approve or charge rider directly',async()=>{
 await assertFails(setDoc(ref('d'),claim('d',3,'approved')));
 await assertFails(updateDoc(doc(db('d'),'rides','job'),{tollsAmount:3,tollAccounting:'separate-v1',lastTollId:'event'}));
 await assertSucceeds(setDoc(ref('d'),claim()));
 await assertFails(updateDoc(ref('d'),{status:'approved',reviewedBy:'d',reviewedAt:serverTimestamp()}));
});
test('only active admin can approve; amount remains immutable',async()=>{
 await setDoc(ref('d'),claim());
 for(const uid of ['d','r','other','inactive'])await assertFails(updateDoc(ref(uid),{status:'approved',reviewedBy:uid,reviewedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref('admin'),{status:'approved',amount:99,reviewedBy:'admin',reviewedAt:serverTimestamp()}));
 const store=db('admin'),batch=writeBatch(store);
 batch.update(doc(store,'rides','job'),{tollsAmount:3,tollAccounting:'separate-v1',lastTollId:'event'});
 batch.update(doc(store,'rides','job','tollEvents','event'),{status:'approved',reviewedBy:'admin',reviewedAt:serverTimestamp()});
 await assertSucceeds(batch.commit());
 await assertFails(updateDoc(ref('admin'),{status:'approved',reviewedBy:'admin',reviewedAt:serverTimestamp()}));
});
test('admin can reject without altering ride charges',async()=>{await setDoc(ref('d'),claim());await assertSucceeds(updateDoc(ref('admin'),{status:'rejected',reviewedBy:'admin',reviewedAt:serverTimestamp()}));});
test('unrelated accounts and invalid amounts cannot submit',async()=>{for(const uid of ['other','r'])await assertFails(setDoc(ref(uid),claim(uid)));for(const n of [0,-1,1.001,501])await assertFails(setDoc(ref('d'),claim('d',n)));});
test('only admins can query all toll claims',async()=>{await setDoc(ref('d'),claim());await assertSucceeds(getDocs(collectionGroup(db('admin'),'tollEvents')));await assertFails(getDocs(collectionGroup(db('other'),'tollEvents')));});
