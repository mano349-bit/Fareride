import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {acceptanceTracker,acceptanceAnnouncement,arrivalEstimate} from './rider-alert-state.js';
test('request tap enables rider voice without AudioContext and acceptance speaks route plus ETA',async()=>{
 const spoken=[],events={},elements=[];let requestTap,changed;
 const auth={currentUser:{uid:'r'}};class Utterance{constructor(text){this.text=text;}}
 const create=()=>{const item={style:{},append(){},setAttribute(){}};elements.push(item);return item;};
 const context=vm.createContext({acceptanceTracker,acceptanceAnnouncement,arrivalEstimate,auth,onAuthStateChanged:(_,cb)=>changed=cb,setTimeout:()=>1,clearTimeout(){},SpeechSynthesisUtterance:Utterance,window:{SpeechSynthesisUtterance:Utterance,speechSynthesis:{cancel(){},speak:utterance=>spoken.push(utterance.text)},addEventListener:(name,cb)=>events[name]=cb},document:{body:{append(){}},createElement:create,querySelector:()=>({prepend(){}}),getElementById:id=>id==='requestBtn'?{addEventListener:(_,cb)=>requestTap=cb}:null}});
 vm.runInContext(fs.readFileSync('rider-alerts.js','utf8').replace(/import[^\n]+\n/g,''),context);changed(auth.currentUser);
 requestTap();await new Promise(resolve=>setImmediate(resolve));assert.match(spoken[0],/voice alerts are enabled/);
 const ride={id:'a',riderId:'r',status:'requested',pickup:'Hartford',dropoff:'West Islip'};
 events['fareride-ride-restored']({detail:ride});
 events['fareride-ride-restored']({detail:{...ride,status:'accepted',driverId:'d',driverName:'Dan',driverLocation:{lat:40,lng:-73},pickupLocation:{lat:40.03,lng:-73},driverLocationUpdatedAt:new Date().toISOString()}});
 assert.equal(spoken.length,2);assert.match(spoken[1],/Dan has accepted.*approximately 3 minutes/);
});
