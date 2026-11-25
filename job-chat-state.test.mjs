import test from 'node:test';
import assert from 'node:assert/strict';
import {chatJobs, chatParticipant, canSendChat, chatMessage, nextChatSelection} from './job-chat-state.js';
const ride = {id:'job',riderId:'r',driverId:'d',status:'accepted'};
const rider = {uid:'r',role:'rider'}, driver = {uid:'d',role:'driver'}, admin = {uid:'a',role:'admin'};
test('rider, assigned driver and verified admin share the same live job', () => {
  for (const actor of [rider,driver,admin]) {assert.equal(chatParticipant(ride,actor),true);assert.equal(canSendChat(ride,actor),true);}
});
test('other drivers, riders and signed-out users cannot join the job', () => {
  for (const actor of [null,{uid:'other',role:'driver'},{uid:'other',role:'rider'},{uid:'r',role:'driver'}]) assert.equal(canSendChat(ride,actor),false);
});
test('before assignment chat is disabled for everyone', () => {
  const open = {...ride,status:'requested',driverId:null};
  assert.equal(canSendChat(open,rider),false);assert.equal(canSendChat(open,admin),false);assert.equal(canSendChat(open,driver),false);
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

test('rider and driver chat show only their current live job while admin keeps all live jobs', () => {
  const older = {...ride,id:'older',status:'accepted',requestedAt:'2026-11-23T10:00:00Z'};
  const current = {...ride,id:'current',status:'started',requestedAt:'2026-11-23T11:00:00Z',startedAt:'2026-11-23T11:15:00Z'};
  const waiting = {...ride,id:'waiting',status:'requested',driverId:null,requestedAt:'2026-11-23T12:00:00Z'};

  assert.deepEqual(chatJobs([older,current,waiting],rider).map(job=>job.id),['current']);
  assert.deepEqual(chatJobs([older,current],driver).map(job=>job.id),['current']);
  assert.deepEqual(chatJobs([older,current,waiting],admin).map(job=>job.id),['current','older']);
});

test('completed selection is replaced by newly accepted job, or cleared',()=>{for(const actor of [rider,driver,admin]){const fresh={...ride,id:'fresh'};const jobs=chatJobs([{...ride,id:'old',status:'completed'},fresh],actor);assert.equal(nextChatSelection(jobs,'old',actor),'fresh');assert.equal(nextChatSelection([],'old',actor),'');}});
