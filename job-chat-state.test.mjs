import test from 'node:test';
import assert from 'node:assert/strict';
import {chatJobs, chatParticipant, canSendChat, chatMessage} from './job-chat-state.js';
const ride = {id:'job',riderId:'r',driverId:'d',status:'accepted'};
const rider = {uid:'r',role:'rider'}, driver = {uid:'d',role:'driver'}, admin = {uid:'a',role:'admin'};
test('rider, assigned driver and verified admin share the same live job', () => {
  for (const actor of [rider,driver,admin]) {assert.equal(chatParticipant(ride,actor),true);assert.equal(canSendChat(ride,actor),true);}
});
test('other drivers, riders and signed-out users cannot join the job', () => {
  for (const actor of [null,{uid:'other',role:'driver'},{uid:'other',role:'rider'},{uid:'r',role:'driver'}]) assert.equal(canSendChat(ride,actor),false);
});
test('before assignment only its rider and admin can chat', () => {
  const open = {...ride,status:'requested',driverId:null};
  assert.equal(canSendChat(open,rider),true);assert.equal(canSendChat(open,admin),true);assert.equal(canSendChat(open,driver),false);
});
test('passenger, tow and bike jobs use the same conversation policy', () => {
  for(const serviceType of ['ride','tow','messenger']) assert.equal(canSendChat({...ride,serviceType},driver),true);
});
test('ending a job leaves participant history readable but stops new messages', () => {
  for(const status of ['completed','cancelled']) for(const actor of [rider,driver,admin]) {
    assert.equal(chatParticipant({...ride,status},actor),true);assert.equal(canSendChat({...ride,status},actor),false);
    assert.throws(()=>chatMessage({...ride,status},actor,'hello'));
  }
});
test('job list excludes finished and unrelated jobs', () => {
  assert.deepEqual(chatJobs([ride,{...ride,id:'other',driverId:'other'},{...ride,id:'ended',status:'completed'}],driver).map(job=>job.id),['job']);
});
test('message validates text and supplies the authenticated sender identity', () => {
  assert.deepEqual(chatMessage(ride,driver,'  hello\nthere  '),{senderId:'d',senderRole:'driver',text:'hello\nthere'});
  for(const text of ['', '   ', 'a'.repeat(2001)]) assert.throws(()=>chatMessage(ride,driver,text));
  assert.equal(chatMessage(ride,driver,'a'.repeat(2000)).text.length,2000);
});
