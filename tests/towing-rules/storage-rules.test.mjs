import {test, before, beforeEach, after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc} from 'firebase/firestore';
import {ref, uploadBytes, getBytes, deleteObject} from 'firebase/storage';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw Error('Run both local emulators. Production access is not supported.');
let env;
const path = 'driverApplications/driver_d/driver-license-123-license.png';
const bytes = new Uint8Array([1,2,3]);
const storage = uid => uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage();
const upload = (uid, file=path, data=bytes, contentType='image/png') => uploadBytes(ref(storage(uid),file),data,{contentType});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride',firestore:{host:'127.0.0.1',port:8080,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')},storage:{host:'127.0.0.1',port:9199,rules:await readFile(new URL('../../storage.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearStorage();await env.clearFirestore();});
after(async()=>{await env?.cleanup();});
test('pending applicant can upload before an application or approval exists',async()=>{await assertSucceeds(upload('d'));await assertSucceeds(getBytes(ref(storage('d'),path)));});
test('anonymous and other applicants cannot upload or read this license',async()=>{
 await assertFails(upload(null));await assertFails(upload('other'));await assertSucceeds(upload('d'));
 await assertFails(getBytes(ref(storage(null),path)));await assertFails(getBytes(ref(storage('other'),path)));
});
test('rider identification follows the rider UID path',async()=>{
 await assertSucceeds(upload('r','riderApplications/rider_r/driver-license-123-id.pdf',bytes,'application/pdf'));
 await assertFails(upload('r','riderApplications/rider_other/driver-license-123-id.pdf',bytes,'application/pdf'));
});
test('only active admin records grant document access',async()=>{
 await assertSucceeds(upload('d'));
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'admins','a'),{active:true});
  await setDoc(doc(c.firestore(),'admins','inactive'),{active:false});
 });
 await assertSucceeds(getBytes(ref(storage('a'),path)));
 await assertFails(getBytes(ref(storage('inactive'),path)));
});
test('documents reject overwrites, deletes, unsupported types, empty and oversized uploads',async()=>{
 await assertSucceeds(upload('d'));await assertFails(upload('d'));
 await assertFails(deleteObject(ref(storage('d'),path)));
 await assertFails(upload('d','driverApplications/driver_d/bad.txt',bytes,'text/plain'));
 await assertFails(upload('d','driverApplications/driver_d/empty.png',new Uint8Array(),'image/png'));
 await assertFails(upload('d','driverApplications/driver_d/large.png',new Uint8Array(10*1024*1024),'image/png'));
 await assertFails(upload('d','unrelated/driver_d/file.png'));
});
