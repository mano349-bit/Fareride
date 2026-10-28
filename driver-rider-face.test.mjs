import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {latestCurrentRide} from './ride-recovery.js';
const face = 'data:image/jpeg;base64,YQ==';
function harness({missingHost = false} = {}) {
  const nodes = new Map(), events = new Map(), subscriptions = [];
  let login, mounted = false, hostMissing = missingHost;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {hidden:true, textContent:'', style:{}, setAttribute(){}, removeAttribute(name){delete this[name];}});
    return nodes.get(id);
  };
  const panel = node('panel');
  Object.defineProperty(panel, 'isConnected', {get:()=>mounted});
  panel.querySelector = node;
  const controls = {after(value){assert.equal(value,panel);mounted=true;}};
  const auth = {currentUser:{uid:'d'}};
  const context = vm.createContext({
    auth, db:{}, latestCurrentRide,
    validRiderFace:value=>typeof value==='string' && value.length <= 200000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value),
    canSeeRiderFace:(ride,uid)=>Boolean(uid && ride?.driverId===uid && ride?.riderId && ['accepted','started','arrived'].includes(ride.status)),
    document:{createElement:()=>panel,querySelector:selector=>hostMissing?null:selector==='section[aria-label="Driver job controls"]'?controls:{prepend(){mounted=true;}}},
    window:{addEventListener:(event,callback)=>events.set(event,callback)},
    onAuthStateChanged:(_,callback)=>login=callback,
    doc:(_,collection,id)=>({kind:'document',collection,id}),
    collection:(_,name)=>({kind:'collection',name}),
    query:(ref,...conditions)=>({kind:'query',ref,conditions}), where:(...condition)=>condition,
    liveSnapshot:(reference,next,error)=>{
      const sub={reference,next,error,stopped:false};subscriptions.push(sub);return ()=>{sub.stopped=true;};
    }
  });
  vm.runInContext(fs.readFileSync('driver-rider-face.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
  const job={id:'job',driverId:'d',riderId:'r',riderName:'Rider Example',status:'accepted'};
  return {
    panel,auth,subscriptions,node,events,
    login:user=>{auth.currentUser=user;login(user);},
    rides:(rides=[job],sub=subscriptions.find(s=>s.reference.kind==='query'&&!s.stopped))=>sub.next({docs:rides.map(ride=>({id:ride.id,data:()=>ride}))}),
    photo:(data={riderId:'r',image:face},sub=[...subscriptions].reverse().find(s=>s.reference.kind==='document'&&!s.stopped))=>sub.next({exists:()=>Boolean(data),data:()=>data}),
    revealHost:()=>hostMissing=false, job
  };
}
test('active rider face loads independently of any restored-job event and uses only job/photo records',()=>{
  const h=harness();h.login(h.auth.currentUser);h.rides();h.photo();
  assert.equal(h.panel.hidden,false);assert.equal(h.node('[data-rider-face]').src,face);
  assert.equal(h.node('[data-rider-name]').textContent,'Rider Example');
  assert.deepEqual(h.subscriptions.filter(s=>s.reference.kind==='document').map(s=>s.reference.collection),['riderFacePhotos']);
  assert.equal(h.subscriptions[0].reference.ref.name,'rides');
});
test('missing portrait, wrong rider and non-JPEG input never display an image',()=>{
  const h=harness();h.login(h.auth.currentUser);h.rides();
  for(const data of [null,{riderId:'other',image:face},{riderId:'r',image:'https://example.com/full-id.jpg'}]){
    h.photo(data);assert.equal(h.node('[data-rider-face]').src,undefined);assert.equal(h.node('[data-rider-face]').hidden,true);
    assert.match(h.node('[role="status"]').textContent,/Waiting for rider/);
  }
});
test('completion, cancellation, logout and stale photo callbacks clear or cannot restore portraits',()=>{
  for(const ending of ['completed','cancelled','logout']){
    const h=harness();h.login(h.auth.currentUser);h.rides();h.photo();
    const late=h.subscriptions.at(-1);
    if(ending==='logout')h.login(null);else h.rides([{...h.job,status:ending}]);
    assert.equal(h.panel.hidden,true);assert.equal(h.node('[data-rider-face]').src,undefined);
    h.photo({riderId:'r',image:face},late);assert.equal(h.panel.hidden,true);assert.equal(h.node('[data-rider-face]').src,undefined);
  }
});
test('photo access errors clear portraits and the retry button starts a new photo subscription',()=>{
  const h=harness();h.login(h.auth.currentUser);h.rides();h.photo();
  const failed=h.subscriptions.at(-1);failed.error({code:'permission-denied'});
  assert.equal(h.node('[data-rider-face]').src,undefined);assert.equal(h.node('button').hidden,false);
  assert.match(h.node('[role="status"]').textContent,/Firestore rules/);
  h.node('button').onclick();assert.equal(failed.stopped,true);h.photo();assert.equal(h.node('[data-rider-face]').src,face);
});
test('a missing host can mount later and page lifecycle never retains the rider portrait',()=>{
  const h=harness({missingHost:true});h.login(h.auth.currentUser);h.rides();
  assert.equal(h.subscriptions.filter(s=>s.reference.kind==='document').length,0);
  h.revealHost();h.rides();h.photo();assert.equal(h.panel.hidden,false);
  h.events.get('pagehide')();assert.equal(h.node('[data-rider-face]').src,undefined);assert.equal(h.panel.hidden,true);
  h.events.get('pageshow')({persisted:true});h.rides();h.photo();assert.equal(h.panel.hidden,false);
});
test('old-account job snapshots cannot reopen a portrait after switching accounts',()=>{
  const h=harness();h.login(h.auth.currentUser);h.rides();h.photo();const old=h.subscriptions[0];
  h.login({uid:'differentDriver'});h.rides([h.job],old);
  assert.equal(h.panel.hidden,true);assert.equal(h.node('[data-rider-face]').src,undefined);
});
