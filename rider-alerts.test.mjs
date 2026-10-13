import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {acceptanceTracker,acceptanceAnnouncement,arrivalEstimate} from './rider-alert-state.js';

function harness() {
 const spoken=[],recorded=[],events={},elements=[],timers=[];
 let recording,requestTap,changed;
 class Audio {constructor(){recording=this;} play(){recorded.push(this.src);return Promise.resolve();} pause(){}}
 const auth={currentUser:{uid:'r'}};
 class Utterance{constructor(text){this.text=text;}}
 const create=()=>{const item={style:{},append(){},setAttribute(){}};elements.push(item);return item;};
 const context=vm.createContext({acceptanceTracker,acceptanceAnnouncement,arrivalEstimate,Audio,URL,auth,
  onAuthStateChanged:(_,cb)=>changed=cb,setTimeout:cb=>{timers.push(cb);return timers.length;},clearTimeout(){},
  SpeechSynthesisUtterance:Utterance,
  window:{SpeechSynthesisUtterance:Utterance,speechSynthesis:{cancel(){},resume(){},speak:utterance=>spoken.push(utterance.text)},addEventListener:(name,cb)=>events[name]=cb},
  document:{body:{append(){}},createElement:create,querySelector:()=>({prepend(){}}),getElementById:id=>id==='requestBtn'?{addEventListener:(_,cb)=>requestTap=cb}:null}});
 vm.runInContext(fs.readFileSync('rider-alerts.js','utf8').replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.com/rider-alerts.js')),context);
 changed(auth.currentUser);
 return {spoken,recorded,timers,recording,request:()=>requestTap(),restore:ride=>events['fareride-ride-restored']({detail:ride}),toggle:()=>elements[1].onclick(),replay:()=>elements[3].onclick(),popup:elements[4],signOut(){auth.currentUser=null;changed(null);}};
}
const ride={id:'a',riderId:'r',status:'requested',pickup:'Hartford',dropoff:'West Islip'};
const accepted={...ride,status:'accepted',driverId:'d',driverName:'Dan'};

test('request enables a test sound; actual acceptance speaks the route and ETA',()=>{
 const h=harness();h.request();assert.match(h.recorded[0],/rider-test.wav/);
 h.restore(ride);assert.equal(h.popup.hidden,true);assert.equal(h.spoken.length,0);
 h.restore({...accepted,driverLocation:{lat:40,lng:-73},pickupLocation:{lat:40.03,lng:-73},driverLocationUpdatedAt:new Date().toISOString()});
 assert.match(h.recorded.at(-1),/rider-accepted.wav/);h.recording.onended();assert.equal(h.spoken.length,1);assert.match(h.spoken[0],/Dan has accepted.*approximately 3 minutes/);
});
test('restoring an older accepted job cannot announce acceptance when requesting a new job',()=>{
 const h=harness();h.restore(accepted);h.request();assert.deepEqual(h.recorded.map(url=>url.split('/').at(-1)),['rider-test.wav']);assert.equal(h.popup.hidden,true);assert.deepEqual(h.spoken,[]);
 h.restore({...ride,id:'new'});h.replay();assert.match(h.recorded.at(-1),/rider-test.wav/);assert.equal(h.spoken.length,0);
});
test('requesting another job cancels stale recording and ETA callbacks',()=>{
 const h=harness();h.request();h.restore(ride);h.restore(accepted);const ended=h.recording.onended;
 h.toggle();h.request();assert.match(h.recorded.at(-1),/rider-test.wav/);ended();assert.equal(h.spoken.length,0);
 h.restore({...accepted,driverLocation:{lat:40,lng:-73},pickupLocation:{lat:40.03,lng:-73},driverLocationUpdatedAt:new Date().toISOString()});
 assert.equal(h.popup.hidden,true);assert.match(h.recorded.at(-1),/rider-test.wav/);
});
test('enabling sounds never replays acceptance; explicit replay uses a confirmed current alert',()=>{
 const h=harness();h.restore(ride);h.restore(accepted);h.toggle();assert.match(h.recorded.at(-1),/rider-test.wav/);
 h.replay();assert.match(h.spoken.at(-1),/Dan has accepted/);
 h.restore({...accepted,status:'cancelled'});h.replay();assert.match(h.recorded.at(-1),/rider-test.wav/);
});
test('old fallback callbacks cannot announce acceptance after a new request or sign out',()=>{
 const h=harness();h.request();h.restore(ride);h.restore(accepted);h.recording.onended();const fallback=h.timers.at(-1);const count=h.recorded.length;
 h.request();fallback();assert.equal(h.recorded.length,count);
 h.signOut();fallback();assert.equal(h.recorded.length,count);
});
