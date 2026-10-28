import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderFaceSharing} from './rider-face-sharing.js';
const image = 'data:image/jpeg;base64,YQ==', nextImage = 'data:image/jpeg;base64,Yg==';
const ride = {id:'job', riderId:'r', driverId:'d', status:'accepted'};
const profile = {uid:'r', image, updatedAt:'2026-10-28T00:00:00Z'};
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(overrides={}) {
  const writes=[], states=[], stored=new Map(), timers=new Map();
  let current=true, time=100, timerId=0, reads=0;
  const sharing=createRiderFaceSharing({uid:'r',isCurrent:()=>current,now:()=>time,
    readShared:async id=>{reads++;return stored.get(id)||null;},
    writeShared:async(id,data)=>{writes.push({id,data});stored.set(id,data);},
    onState:state=>states.push(state),
    setTimer:callback=>{timers.set(++timerId,callback);return timerId;},clearTimer:id=>timers.delete(id),...overrides});
  return {sharing,writes,states,stored,reads:()=>reads,logout:()=>{current=false;},advance:amount=>{time+=amount;},retryTimer:()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(callback=>callback());}};
}
test('a confirmed profile appearing after acceptance shares only the cropped face',async()=>{
  const h=harness();h.sharing.setRides([ride]);h.sharing.setProfile(null);await tick();assert.equal(h.writes.length,0);assert.equal(h.states.at(-1).kind,'missing');
  h.sharing.setProfile({...profile,licenseNumber:'private',originalId:'private',documents:{private:true}});await tick();
  assert.deepEqual(h.writes,[{id:'job',data:{riderId:'r',image}}]);assert.equal(h.states.at(-1).kind,'saved');
});
test('requested, completed, cancelled, unassigned and unrelated rider jobs never receive a face',async()=>{
  for(const status of ['requested','completed','cancelled']){
    const h=harness();h.sharing.setProfile(profile);h.sharing.setRides([{...ride,status}]);await tick();assert.equal(h.writes.length,0);
  }
  for(const invalid of [{...ride,driverId:null},{...ride,riderId:'other'}]){
    const h=harness();h.sharing.setProfile(profile);h.sharing.setRides([invalid]);await tick();assert.equal(h.writes.length,0);
  }
});
test('all active job types share a confirmed crop without sending an ID',async()=>{
  const h=harness();h.sharing.setProfile(profile);h.sharing.setRides(['accepted','arrived','started'].map((status,index)=>({...ride,id:String(index),status,serviceType:index===0?'tow':'ride'})));await tick();
  assert.equal(h.writes.length,3);assert.ok(h.writes.every(write=>Object.keys(write.data).sort().join(',')==='image,riderId'));
});
test('repeated snapshots do not rewrite the same crop, while changed confirmed crops update',async()=>{
  const h=harness();h.sharing.setProfile(profile);h.sharing.setRides([ride]);await tick();
  h.sharing.setProfile(profile);h.sharing.setRides([{...ride,status:'started'}]);await tick();assert.equal(h.writes.length,1);
  h.sharing.setProfile({...profile,image:nextImage});await tick();assert.equal(h.writes.length,2);assert.equal(h.writes[1].data.image,nextImage);
});
test('matching server records skip a write after a dashboard reload',async()=>{
  const h=harness();h.stored.set('job',{riderId:'r',image});h.sharing.setProfile(profile);h.sharing.setRides([ride]);await tick();assert.equal(h.writes.length,0);assert.equal(h.states.at(-1).kind,'saved');
});
test('late reads cannot write a face after logout, cancellation, driver change or disposal',async()=>{
  for(const end of ['logout','cancelled','driverChanged','dispose']){
    let release;const h=harness({readShared:()=>new Promise(resolve=>release=resolve)});
    h.sharing.setProfile(profile);h.sharing.setRides([ride]);
    if(end==='logout')h.logout();
    if(end==='cancelled')h.sharing.setRides([{...ride,status:'cancelled'}]);
    if(end==='driverChanged')h.sharing.setRides([{...ride,driverId:'new-driver'}]);
    if(end==='dispose')h.sharing.dispose();
    release(null);await tick();assert.equal(h.writes.length,0,end);
    h.sharing.dispose();
  }
});
test('profile changes during a read discard the old crop and share the current crop',async()=>{
  let release, calls=0;const h=harness({readShared:()=>++calls===1?new Promise(resolve=>release=resolve):Promise.resolve(null)});
  h.sharing.setProfile(profile);h.sharing.setRides([ride]);h.sharing.setProfile({...profile,image:nextImage});release(null);await tick();
  assert.deepEqual(h.writes,[{id:'job',data:{riderId:'r',image:nextImage}}]);
});
test('malformed, oversized, foreign and unconfirmed source profiles never share',async()=>{
  for(const invalid of [null,{...profile,uid:'other'},{...profile,image:'https://example.com/id.png'},{...profile,image:'data:application/pdf;base64,YQ=='},{...profile,image:'data:image/jpeg;base64,'+'A'.repeat(200000)}]){
    const h=harness();h.sharing.setRides([ride]);h.sharing.setProfile(invalid);await tick();assert.equal(h.writes.length,0);
  }
});
test('a permission failure is visible and retries without changing the job',async()=>{
  let calls=0;const h=harness({writeShared:async(id,data)=>{if(++calls===1)throw Object.assign(Error('Blocked'),{code:'permission-denied'});}});
  h.sharing.setProfile(profile);h.sharing.setRides([ride]);await tick();assert.equal(h.states.at(-1).kind,'error');
  h.advance(15001);h.retryTimer();await tick();assert.equal(calls,2);assert.equal(h.states.at(-1).kind,'saved');
  assert.deepEqual(ride,{id:'job',riderId:'r',driverId:'d',status:'accepted'});
});

// Exercise the browser wiring separately from the sharing controller.
import fs from 'node:fs';
import vm from 'node:vm';
function browserHarness() {
  const watched=[], writes=[], reads=[], events=new Map();let login;
  const message={hidden:true,textContent:'',isConnected:false,setAttribute(){}};
  const auth={currentUser:{uid:'r'}};
  const context=vm.createContext({auth,db:{},document:{createElement:()=>message,getElementById:()=>({after:node=>{node.isConnected=true;}}),querySelector:()=>({prepend:node=>{node.isConnected=true;}})},
    window:{addEventListener:(name,callback)=>events.set(name,callback)},
    doc:(_,name,id)=>({name,id}),collection:(_,name)=>name,where:(...args)=>args,query:(name,filter)=>({name,filter}),
    onAuthStateChanged:(_,callback)=>login=callback,
    liveSnapshot:(reference,next,error)=>{const watch={reference,next,error,stopped:false};watched.push(watch);return()=>{watch.stopped=true;};},
    getDocFromServer:async reference=>{reads.push(reference);return {exists:()=>false};},
    setDoc:async(reference,data)=>writes.push({reference,data}),
    createRiderFaceSharing:options=>createRiderFaceSharing({...options,setTimer:()=>0,clearTimer:()=>{}})
  });
  vm.runInContext(fs.readFileSync(new URL('./rider-face-publisher.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,''),context);
  return {message,auth,watched,writes,reads,events,login:()=>login(auth.currentUser),snapshot:(name,data)=>watched.findLast(w=>w.reference.name===name).next({exists:()=>Boolean(data),data:()=>data}),rides:data=>watched.findLast(w=>w.reference.name==='rides').next({docs:data.map(ride=>({id:ride.id,data:()=>ride}))})};
}
test('browser publisher discovers existing jobs independently and observes later crop confirmation',async()=>{
  const h=browserHarness();h.login();h.snapshot('users',{role:'rider',accountStatus:'approved'});h.snapshot('riderFaceProfiles',null);h.rides([ride]);await tick();assert.equal(h.writes.length,0);assert.match(h.message.textContent,/Confirm a face-only crop/);
  h.snapshot('riderFaceProfiles',profile);await tick();assert.equal(h.writes.length,1);
  assert.equal(h.writes[0].reference.name,'riderFacePhotos');assert.equal(h.writes[0].data.image,image);
  assert.ok(h.watched.every(w=>['users','riderFaceProfiles','rides'].includes(w.reference.name)));
  assert.ok(h.reads.every(reference=>reference.name==='riderFacePhotos'));
});
test('permission diagnostics remain visible after unrelated ride snapshots and reconnect resubscribes',()=>{
  const h=browserHarness();h.login();h.snapshot('users',{role:'rider',accountStatus:'approved'});
  h.watched.find(w=>w.reference.name==='riderFaceProfiles').error({code:'permission-denied'});h.rides([ride]);assert.match(h.message.textContent,/updated Cloud Firestore rules/);
  const previous=h.watched.length;h.events.get('focus')();assert.ok(h.watched.length>previous);assert.ok(h.watched.slice(0,previous).every(w=>w.stopped));
});
test('logout stops listeners and late photo/job snapshots cannot share a face',async()=>{
  const h=browserHarness();h.login();h.snapshot('users',{role:'rider',accountStatus:'approved'});
  const profileWatch=h.watched.find(w=>w.reference.name==='riderFaceProfiles'),rideWatch=h.watched.find(w=>w.reference.name==='rides');
  h.auth.currentUser=null;h.login();profileWatch.next({exists:()=>true,data:()=>profile});rideWatch.next({docs:[{id:'job',data:()=>ride}]});await tick();
  assert.equal(h.writes.length,0);assert.equal(h.message.hidden,true);assert.ok(h.watched.every(w=>w.stopped));
});
test('non-rider or unapproved accounts cannot start face sharing',()=>{
  for(const account of [{role:'driver',accountStatus:'approved'},{role:'rider',accountStatus:'pending'}]){
    const h=browserHarness();h.login();h.snapshot('users',account);assert.equal(h.watched.length,1);assert.equal(h.message.hidden,true);
  }
});
