import {test,before,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,setDoc,getDoc,getDocs,updateDoc,deleteDoc,serverTimestamp,Timestamp,query,orderBy,limit,onSnapshot} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Run using the Firestore emulator; production access is not supported.');
let env;
const db=uid=>uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const ref=uid=>doc(db(uid),'rides','job','messages','message');
const message=(uid,role,extra={})=>({senderId:uid,senderRole:role,text:'Hello everyone',createdAt:serverTimestamp(),...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride-chat',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL(process.env.FARERIDE_RULES_FILE || '../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const store=context.firestore();
  await setDoc(doc(store,'rides','job'),{riderId:'r',driverId:'d',status:'accepted',serviceType:'ride'});
  await setDoc(doc(store,'admins','a'),{active:true});
  await setDoc(doc(store,'admins','inactive'),{active:false});
  await setDoc(doc(store,'rides','job','messages','existing'),{senderId:'r',senderRole:'rider',text:'Existing',createdAt:Timestamp.now()});
 });
});
after(()=>env?.cleanup());
test('rider, assigned driver and active admin can send and read the same conversation',async()=>{
 for(const [uid,role] of [['r','rider'],['d','driver'],['a','admin']]) {
  await assertSucceeds(setDoc(ref(uid),message(uid,role)));
  await assertSucceeds(getDoc(ref(uid)));
  await assertSucceeds(getDocs(query(collection(db(uid),'rides','job','messages'),orderBy('createdAt','desc'),limit(100))));
  await env.withSecurityRulesDisabled(context=>deleteDoc(doc(context.firestore(),'rides','job','messages','message')));
 }
});
test('unassigned drivers, unrelated riders, inactive admins and guests cannot read or send',async()=>{
 for(const uid of ['other-driver','other-rider','inactive',null]) {
  await assertFails(getDoc(doc(db(uid),'rides','job','messages','existing')));
  await assertFails(getDocs(collection(db(uid),'rides','job','messages')));
  await assertFails(setDoc(ref(uid),message(uid||'guest','driver')));
 }
});
test('sender identity and role cannot be forged',async()=>{
 await assertFails(setDoc(ref('d'),message('r','rider')));
 await assertFails(setDoc(ref('d'),message('d','admin')));
 await assertFails(setDoc(ref('r'),message('r','driver')));
 await assertFails(setDoc(ref('a'),message('a','driver')));
});
test('only bounded text with a server timestamp and the allowed fields can be stored',async()=>{
 for(const extra of [{text:''},{text:'x'.repeat(2001)},{text:123},{createdAt:Timestamp.fromMillis(0)},{driverId:'d'}]) await assertFails(setDoc(ref('d'),message('d','driver',extra)));
 await assertSucceeds(setDoc(ref('d'),message('d','driver',{text:'x'.repeat(2000)})));
});
test('messages cannot be edited or deleted, even by admin',async()=>{
 for(const uid of ['r','d','a']) {
  await assertFails(updateDoc(doc(db(uid),'rides','job','messages','existing'),{text:'Changed'}));
  await assertFails(deleteDoc(doc(db(uid),'rides','job','messages','existing')));
 }
});
test('requested jobs allow their rider and admin but do not expose chat to browsing drivers',async()=>{
 await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'rides','job'),{status:'requested',driverId:null}));
 await assertSucceeds(setDoc(ref('r'),message('r','rider')));
 await assertSucceeds(setDoc(doc(db('a'),'rides','job','messages','admin'),message('a','admin')));
 await assertFails(getDocs(collection(db('d'),'rides','job','messages')));
 await assertFails(setDoc(ref('d'),message('d','driver')));
});
test('completed and cancelled jobs retain readable history and reject new messages',async()=>{
 for(const status of ['completed','cancelled']) {
  await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),'rides','job'),{status}));
  for(const [uid,role] of [['r','rider'],['d','driver'],['a','admin']]) {
   await assertSucceeds(getDoc(doc(db(uid),'rides','job','messages','existing')));
   await assertFails(setDoc(ref(uid),message(uid,role)));
  }
 }
});
test('permissions follow the assigned driver and cannot leak between job conversations',async()=>{
 await env.withSecurityRulesDisabled(async context=>{
  await updateDoc(doc(context.firestore(),'rides','job'),{driverId:'replacement'});
  await setDoc(doc(context.firestore(),'rides','other'),{riderId:'other-rider',driverId:'other-driver',status:'accepted'});
 });
 await assertFails(getDocs(collection(db('d'),'rides','job','messages')));
 await assertSucceeds(setDoc(ref('replacement'),message('replacement','driver')));
 await assertFails(setDoc(doc(db('r'),'rides','other','messages','leak'),message('r','rider')));
});
test('admin cannot create a conversation for a nonexistent job',async()=>{
 await assertFails(setDoc(doc(db('a'),'rides','missing','messages','message'),message('a','admin')));
});

test('all three participants receive each new message through live listeners', {timeout:15000}, async()=>{
 const stops=[];
 const received=['r','d','a'].map(uid=>new Promise((resolve,reject)=>{
  stops.push(onSnapshot(collection(db(uid),'rides','job','messages'),snapshot=>{
   const ids=new Set(snapshot.docs.map(item=>item.id));
   if(['from-r','from-d','from-a'].every(id=>ids.has(id)))resolve();
  },reject));
 }));
 try {
  await Promise.all([['r','rider'],['d','driver'],['a','admin']].map(([uid,role])=>setDoc(doc(db(uid),'rides','job','messages','from-'+uid),message(uid,role))));
  await Promise.all(received);
 } finally {stops.forEach(stop=>stop());}
});
