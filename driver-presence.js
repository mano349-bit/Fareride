import {auth,db,doc,getDoc,setDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {deleteDoc} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {claimDriverDetails} from './driver-claim.js';
import {validCoordinates,ACTIVE_STATUSES} from './ride-details.js';
import {setDriverOnline,registerDriverSessionLifecycle} from './driver-availability.js?v=20261026-auto-online';
import {observeSessionLocation} from './session-location.js';
const panel=document.createElement('section');panel.className='card';panel.style.cssText='padding:16px;margin:16px 0';
const heading=document.createElement('h3');heading.textContent='Driver status';
const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Checking your Driver sign-in…';
panel.append(heading,message);document.querySelector('main')?.prepend(panel);
let user,application,heartbeat,stopJobs,stopLocation,point,pointAt=0,busy=false,revision=0,authRevision=0,lastSent=0;
let writes=Promise.resolve();
function report(text){
 message.textContent=user&&navigator.onLine===false?'Online while signed in. Connection lost; jobs and location updates resume when reconnected.':text;
}
function publish(available=Boolean(user)&&!busy){
 const actor=user,app=application,location=point,version=revision;
 if(!actor||auth.currentUser?.uid!==actor.uid)return Promise.resolve(false);
 available=available&&validCoordinates(location)&&Date.now()-pointAt<=90000;
 const serviceType=document.getElementById('providerService')?.value||'ride';
 const operation=writes.then(async()=>{
  if(auth.currentUser?.uid!==actor.uid||version!==revision)return false;
  const ref=doc(db,'driverPresence',actor.uid);
  if(!validCoordinates(location)||!app)await deleteDoc(ref);
  else await setDoc(ref,{uid:actor.uid,driverName:app.fullName,vehicleYear:app.vehicleYear,vehicleMake:app.vehicleMake,vehicleModel:app.vehicleModel,serviceType,lat:location.lat,lng:location.lng,available,updatedAt:serverTimestamp()});
  if(version===revision&&auth.currentUser?.uid===actor.uid){
   lastSent=Date.now();
   report(busy?'Online: receiving jobs. Your current trip is active; you are hidden from nearby-driver results.':available?'Online: receiving jobs and visible to nearby riders.':'Online: receiving jobs. Waiting for location permission or GPS before showing you to nearby riders.');
  }
  return true;
 });
 writes=operation.catch(()=>{});
 return operation.catch(()=>{if(version===revision)report('Online: receiving jobs. Nearby-rider visibility could not be confirmed; check your connection or contact FareRide Admin.');return false;});
}
function reset(){revision++;setDriverOnline(false);clearInterval(heartbeat);heartbeat=null;stopJobs?.();stopJobs=null;stopLocation?.();stopLocation=null;user=null;application=null;point=null;pointAt=0;busy=false;lastSent=0;}
async function initialize(next){
 const current=++authRevision;reset();
 if(!next){message.textContent='Signed out: driver is offline.';return;}
 const [profile,app]=await Promise.all([getDoc(doc(db,'users',next.uid)),getDoc(doc(db,'driverApplications','driver_'+next.uid)).catch(()=>null)]).catch(()=>[]);
 if(current!==authRevision||auth.currentUser?.uid!==next.uid)return;
 if(!profile?.exists()||profile.data().role!=='driver'){message.textContent='Sign in with your Driver account.';return;}
 user=next;const details=claimDriverDetails(next.uid,profile.data(),app?.exists()?app.data():{});
 application={fullName:details.driverName,vehicleYear:details.vehicleYear,vehicleMake:details.vehicleMake,vehicleModel:details.vehicleModel};
 setDriverOnline(true);report('Online: receiving jobs. Location sharing starts automatically.');publish(false);
 stopLocation=observeSessionLocation(state=>{
  if(current!==authRevision||state.uid!==next.uid)return;
  if(state.position){
   const firstFix=!validCoordinates(point)||Date.now()-pointAt>90000;
   point={lat:state.position.coords.latitude,lng:state.position.coords.longitude};pointAt=state.position.timestamp||Date.now();
   const locationMessage=document.getElementById('locationStatus');if(locationMessage)locationMessage.textContent='Live location sharing is automatic while signed in.';
   if(firstFix||Date.now()-lastSent>15000)publish();
  }else if(state.error){
   pointAt=0;publish(false);
   const locationMessage=document.getElementById('locationStatus');if(locationMessage)locationMessage.textContent=state.error.code===1?'Allow location permission in your browser or device settings. Sharing resumes automatically.':'Location is unavailable. Sharing retries automatically.';
  }
 });
 stopJobs=onSnapshot(query(collection(db,'rides'),where('driverId','==',next.uid)),snapshot=>{if(current!==authRevision)return;busy=snapshot.docs.some(job=>ACTIVE_STATUSES.includes(job.data().status));publish();},()=>{if(current!==authRevision)return;busy=true;publish(false);});
 heartbeat=setInterval(()=>publish(),20000);
}
onAuthStateChanged(auth,initialize);
registerDriverSessionLifecycle(async()=>{
 const actor=user;authRevision++;reset();
 await writes;
 if(actor&&auth.currentUser?.uid===actor.uid)await deleteDoc(doc(db,'driverPresence',actor.uid));
},()=>initialize(auth.currentUser));
document.getElementById('providerService')?.addEventListener('change',()=>publish());
window.addEventListener('offline',()=>report('Online while signed in. Connection lost; reconnecting automatically.'));
window.addEventListener('online',()=>{if(user)publish();});
