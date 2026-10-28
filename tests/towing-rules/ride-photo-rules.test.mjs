import {test, before, beforeEach, after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, getDocs, collection, updateDoc} from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Local emulator required; no production access.');
let env;
const image='data:image/jpeg;base64,YQ==';
const photos={driverId:'d',portrait:image,vehicle:image,plateNumber:'ABC123'};
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  for(const [uid,role] of [['d','driver'],['otherDriver','driver'],['r','rider'],['otherRider','rider']])await setDoc(doc(c.firestore(),'users',uid),{uid,role,accountStatus:'approved'});
  await setDoc(doc(c.firestore(),'driverApplications','driver_d'),{documents:{driverPortrait:{image},vehicleFront:{image},driverLicense:{private:true}},plateNumber:'ABC123'});
  await setDoc(doc(c.firestore(),'rides','job'),{driverId:'d',riderId:'r',status:'accepted'});
 });
});
after(async()=>{await env?.cleanup();});
test('assigned driver shares approved application images and only the assigned rider can fetch them',async()=>{
 await assertSucceeds(setDoc(doc(db('d'),'rideDriverPhotos','job'),photos));
 await assertSucceeds(getDoc(doc(db('r'),'rideDriverPhotos','job')));
 for(const uid of [null,'otherRider','otherDriver'])await assertFails(getDoc(doc(db(uid),'rideDriverPhotos','job')));
 await assertFails(getDoc(doc(db('r'),'driverApplications','driver_d')));
 await assertFails(getDocs(collection(db('r'),'rideDriverPhotos')));
});
test('sharing and viewing are allowed in each active status and end at completion or cancellation',async()=>{
 for(const status of ['accepted','started','arrived']){
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'rides',status),{driverId:'d',riderId:'r',status}));
  await assertSucceeds(setDoc(doc(db('d'),'rideDriverPhotos',status),photos));
  await assertSucceeds(getDoc(doc(db('r'),'rideDriverPhotos',status)));
 }
 await assertSucceeds(setDoc(doc(db('d'),'rideDriverPhotos','job'),photos));
 for(const status of ['completed','cancelled','requested']){
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'rides','job'),{status}));
  await assertFails(getDoc(doc(db('r'),'rideDriverPhotos','job')));
 }
});
test('other actors, unrelated application images, oversized payloads and private extra fields are rejected',async()=>{
 for(const uid of [null,'r','otherRider','otherDriver'])await assertFails(setDoc(doc(db(uid),'rideDriverPhotos','job'),photos));
 await assertFails(setDoc(doc(db('d'),'rideDriverPhotos','job'),{...photos,portrait:'data:image/jpeg;base64,Yg=='}));
 await assertFails(setDoc(doc(db('d'),'rideDriverPhotos','job'),{...photos,portrait:'data:image/jpeg;base64,'+'A'.repeat(350000)}));
 await assertFails(setDoc(doc(db('d'),'rideDriverPhotos','job'),{...photos,driverLicense:'private'}));
 await assertSucceeds(setDoc(doc(db('d'),'rideDriverPhotos','job'),photos));
 await assertFails(updateDoc(doc(db('d'),'rideDriverPhotos','job'),{plateNumber:'OTHER'}));
});
