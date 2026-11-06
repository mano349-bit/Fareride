import {test,before,beforeEach,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,serverTimestamp} from 'firebase/firestore';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Firestore emulator required; never use production.');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fareride-tax',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
 const db=context.firestore();await setDoc(doc(db,'rides','job'),{status:'completed',driverId:'d',riderId:'r',fare:28.33,totalFare:28.33});
 for(const [uid,role,accountStatus]of [['d','driver','active'],['other','driver','active'],['r','rider','active'],['suspended','driver','suspended']])await setDoc(doc(db,'users',uid),{role,accountStatus});
});});
after(()=>env?.cleanup());
const record={state:'NY',jurisdiction:'New York',rate:8.875,base:28.33,fixed:0,amount:2.51,source:'driver-confirmed',recordedBy:'d',riderAgreed:true,reviewedOn:'2026-11-06',selection:'manual'};
const save=(uid='d',changes={},extra={})=>updateDoc(doc(env.authenticatedContext(uid).firestore(),'rides','job'),{rideTax:{...record,...changes},rideTaxRecordedAt:serverTimestamp(),...extra});
test('assigned active driver can add rounded tax once',async()=>{await assertSucceeds(save());await assertFails(save());});
test('unrelated driver and rider cannot charge tax',async()=>{await assertFails(save('other',{recordedBy:'other'}));await assertFails(save('r',{recordedBy:'r'}));});
test('cannot alter fare, total, tax formula, agreement, jurisdiction, or audit identity',async()=>{
 for(const changes of [{amount:9},{rate:-1},{rate:101},{fixed:0.001},{base:1.001},{state:'XX'},{jurisdiction:''},{recordedBy:'other'},{riderAgreed:false},{source:'automatic'}])await assertFails(save('d',changes));
 await assertFails(save('d',{}, {fare:100}));await assertFails(save('d',{}, {totalFare:100}));
});
test('explicit zero and fixed trip fee can be recorded',async()=>{await assertSucceeds(save('d',{state:'CT',jurisdiction:'Connecticut',rate:0,fixed:.3,amount:.3}));});
test('legacy tax cannot be double charged',async()=>{await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'rides','job'),{taxAmount:0}));await assertFails(save());});
test('in-progress and suspended driver tax writes fail',async()=>{
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'rides','job'),{status:'started'}));await assertFails(save());
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'rides','job'),{status:'completed',driverId:'suspended'}));await assertFails(save('suspended',{recordedBy:'suspended'}));
});
