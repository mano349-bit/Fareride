import {test, before, beforeEach, after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc} from 'firebase/firestore';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Local emulator required; no production access.');
let env;
const image = 'data:image/jpeg;base64,YQ==';
const secondImage = 'data:image/jpeg;base64,Yg==';
const updatedAt = '2026-10-28T00:00:00.000Z';
const profile = {uid:'r',image,updatedAt};
const sharedFace = {riderId:'r',image};
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const setRide = (id,status,extra={}) => env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'rides',id),{driverId:'d',riderId:'r',status,...extra}));
before(async()=>{
 env = await initializeTestEnvironment({projectId:'demo-fareride',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  for(const [uid,role,accountStatus] of [['r','rider','approved'],['r2','rider','active'],['pending','rider','pending'],['suspended','rider','suspended'],['d','driver','approved'],['d2','driver','approved']]) {
   await setDoc(doc(c.firestore(),'users',uid),{uid,role,accountStatus});
  }
  await setDoc(doc(c.firestore(),'admins','a'),{active:true});
  await setDoc(doc(c.firestore(),'riderApplications','rider_r'),{uid:'r',documents:{driverLicense:{path:'private-id-file'}}});
 });
 await setRide('job','accepted');
});
after(async()=>{await env?.cleanup();});

test('approved riders can save and update only their own bounded face profile',async()=>{
 await assertSucceeds(setDoc(doc(db('r'),'riderFaceProfiles','r'),profile));
 await assertSucceeds(updateDoc(doc(db('r'),'riderFaceProfiles','r'),{image:secondImage,updatedAt}));
 await assertSucceeds(getDoc(doc(db('r'),'riderFaceProfiles','r')));
 await assertSucceeds(getDoc(doc(db('a'),'riderFaceProfiles','r')));
 for(const uid of [null,'r2','d','d2']) await assertFails(getDoc(doc(db(uid),'riderFaceProfiles','r')));
 await assertSucceeds(setDoc(doc(db('r2'),'riderFaceProfiles','r2'),{...profile,uid:'r2'}));
});

test('profile writes reject wrong actors, wrong UID, private ID metadata and invalid images',async()=>{
 for(const uid of [null,'r2','d']) await assertFails(setDoc(doc(db(uid),'riderFaceProfiles','r'),profile));
 for(const uid of ['pending','suspended']) await assertFails(setDoc(doc(db(uid),'riderFaceProfiles',uid),{...profile,uid}));
 await assertFails(setDoc(doc(db('d'),'riderFaceProfiles','d'),{...profile,uid:'d'}));
 await assertFails(setDoc(doc(db('r'),'riderFaceProfiles','r'),{...profile,uid:'r2'}));
 await assertFails(setDoc(doc(db('r'),'riderFaceProfiles','r'),{...profile,idNumber:'private'}));
 await assertFails(setDoc(doc(db('r'),'riderFaceProfiles','r'),{...profile,documentPath:'private-id-file'}));
 for(const invalid of ['https://example.com/id.jpg','data:image/svg+xml;base64,YQ==','data:image/jpeg;base64,'+'A'.repeat(200000)]) {
  await assertFails(setDoc(doc(db('r'),'riderFaceProfiles','r'),{...profile,image:invalid}));
 }
 await assertFails(getDocs(collection(db('r'),'riderFaceProfiles')));
});

test('only the assigned active driver, rider and administrator can fetch the shared crop',async()=>{
 await assertSucceeds(setDoc(doc(db('r'),'riderFaceProfiles','r'),profile));
 await assertSucceeds(setDoc(doc(db('r'),'riderFacePhotos','job'),sharedFace));
 for(const uid of ['d','r','a']) await assertSucceeds(getDoc(doc(db(uid),'riderFacePhotos','job')));
 for(const uid of [null,'r2','d2']) await assertFails(getDoc(doc(db(uid),'riderFacePhotos','job')));
 await assertFails(getDoc(doc(db('d'),'riderFaceProfiles','r')));
 await assertFails(getDoc(doc(db('d'),'riderApplications','rider_r')));
 await assertFails(getDocs(collection(db('d'),'riderFacePhotos')));
});

test('sharing is allowed in accepted, started and arrived jobs and expires at either terminal status',async()=>{
 await assertSucceeds(setDoc(doc(db('r'),'riderFaceProfiles','r'),profile));
 for(const status of ['accepted','started','arrived']) {
  await setRide(status,status);
  await assertSucceeds(setDoc(doc(db('r'),'riderFacePhotos',status),sharedFace));
  await assertSucceeds(getDoc(doc(db('d'),'riderFacePhotos',status)));
 }
 await assertSucceeds(setDoc(doc(db('r'),'riderFacePhotos','job'),sharedFace));
 for(const status of ['completed','cancelled','requested']) {
  await setRide('job',status);
  for(const uid of ['d','r']) await assertFails(getDoc(doc(db(uid),'riderFacePhotos','job')));
  await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),sharedFace));
  await assertFails(updateDoc(doc(db('r'),'riderFacePhotos','job'),{image:secondImage}));
 }
 await assertSucceeds(getDoc(doc(db('a'),'riderFacePhotos','job')));
});

test('shared writes reject nonparticipants, nonexistent profiles, substituted images and ID fields',async()=>{
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),sharedFace));
 await assertSucceeds(setDoc(doc(db('r'),'riderFaceProfiles','r'),profile));
 for(const uid of [null,'r2','d','d2']) await assertFails(setDoc(doc(db(uid),'riderFacePhotos','job'),sharedFace));
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),{...sharedFace,riderId:'r2'}));
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),{...sharedFace,image:secondImage}));
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),{...sharedFace,driverLicense:'private-id-file'}));
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','job'),{...sharedFace,idNumber:'private'}));
 await assertFails(setDoc(doc(db('r'),'riderFacePhotos','missing-job'),sharedFace));
});

test('a confirmed new crop can update the active share but stale drivers and riders lose access',async()=>{
 await assertSucceeds(setDoc(doc(db('r'),'riderFaceProfiles','r'),profile));
 await assertSucceeds(setDoc(doc(db('r'),'riderFacePhotos','job'),sharedFace));
 await assertSucceeds(updateDoc(doc(db('r'),'riderFaceProfiles','r'),{image:secondImage,updatedAt}));
 await assertFails(updateDoc(doc(db('r'),'riderFacePhotos','job'),{image}));
 await assertSucceeds(updateDoc(doc(db('r'),'riderFacePhotos','job'),{image:secondImage}));
 await setRide('job','accepted',{driverId:'d2'});
 await assertFails(getDoc(doc(db('d'),'riderFacePhotos','job')));
 await assertSucceeds(getDoc(doc(db('d2'),'riderFacePhotos','job')));
 await setRide('job','accepted',{riderId:'r2'});
 await assertFails(getDoc(doc(db('r'),'riderFacePhotos','job')));
 await assertFails(getDoc(doc(db('d'),'riderFacePhotos','job')));
 await assertFails(getDoc(doc(db('r2'),'riderFacePhotos','job')));
 await assertFails(updateDoc(doc(db('r'),'riderFacePhotos','job'),{image:secondImage}));
 await assertFails(deleteDoc(doc(db('r'),'riderFacePhotos','job')));
});
