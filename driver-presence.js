import {auth,db,doc,getDoc,setDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {deleteDoc} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {validCoordinates,ACTIVE_STATUSES} from './ride-details.js';
import {setDriverOnline,isDriverOnline} from './driver-availability.js';
const panel=document.createElement('section');panel.className='card';panel.style.cssText='padding:16px;margin:16px 0';
const heading=document.createElement('h3');heading.textContent='Available for nearby riders';
const button=document.createElement('button');button.type='button';button.textContent='Go online';button.disabled=true;button.style.cssText='padding:12px;background:#1473e6;color:white;border:0;border-radius:8px';
const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Offline: go online to receive new jobs and appear to nearby riders.';
panel.append(heading,message,button);document.querySelector('main')?.prepend(panel);
let user,application,watch,heartbeat,stopJobs,point,busy=false,enabled=false,lastSent=0,pointAt=0,revision=0,authRevision=0,offlineUnconfirmed=false;
// Serialize writes so an older online update cannot overwrite the offline update.
let writes=Promise.resolve();
function publish(available=enabled&&!busy) {
 const actor=user,app=application,location=point,version=revision;
 if(!actor||auth.currentUser?.uid!==actor.uid)return Promise.resolve(false);
 available=available&&validCoordinates(location)&&Date.now()-pointAt<=90000;
 const serviceType=document.getElementById('providerService')?.value||'ride';
 const operation=writes.then(async()=>{
  if(auth.currentUser?.uid!==actor.uid)return false;
  if(available&&(!enabled||revision!==version))return false;
  const ref=doc(db,'driverPresence',actor.uid);
  if(!validCoordinates(location)||!app)await deleteDoc(ref);
  else await setDoc(ref,{uid:actor.uid,driverName:app.fullName,vehicleYear:app.vehicleYear,vehicleMake:app.vehicleMake,vehicleModel:app.vehicleModel,serviceType,lat:location.lat,lng:location.lng,available,updatedAt:serverTimestamp()});
  if(revision===version&&auth.currentUser?.uid===actor.uid){
   lastSent=Date.now();setDriverOnline(enabled&&available);
   if(!enabled){offlineUnconfirmed=false;button.textContent='Go online';}
   message.textContent=!enabled?'Offline: no new jobs, and you are hidden from nearby riders.':busy?'On a ride: hidden from available-driver results.':available?'Online: receiving new jobs and visible to nearby riders.':'Waiting for a fresh GPS location. New jobs are paused.';
  }
  return true;
 });
 writes=operation.catch(()=>{});
 return operation.catch(()=>{
  if(revision===version&&auth.currentUser?.uid===actor.uid){
   setDriverOnline(false);
   if(!enabled){offlineUnconfirmed=true;button.textContent='Retry go offline';}
   message.textContent=enabled?'Availability could not be confirmed. New jobs are paused. Check your connection.':'New jobs are paused here, but hiding you from riders is not confirmed. Reconnect and retry Go offline; old location updates expire within 90 seconds.';
  }
  return false;
 });
}
function stop(){
 enabled=false;revision++;setDriverOnline(false);
 if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;
 clearInterval(heartbeat);heartbeat=null;button.textContent='Go online';
 message.textContent='Stopping new jobs and hiding you from nearby riders…';
 return publish(false);
}
button.onclick=()=>{
 if(enabled||offlineUnconfirmed){stop();return;}
 if(!user||button.disabled)return;
 if(!navigator.geolocation){message.textContent='GPS is unavailable.';return;}
 enabled=true;revision++;button.textContent='Go offline';message.textContent='Getting your location and confirming availability…';
 const sharingUID=user.uid,version=revision;
 watch=navigator.geolocation.watchPosition(position=>{
  if(!enabled||revision!==version||auth.currentUser?.uid!==sharingUID)return;
  pointAt=position.timestamp||Date.now();point={lat:position.coords.latitude,lng:position.coords.longitude};
  if(!isDriverOnline()||Date.now()-lastSent>15000)publish();
 },()=>{
  if(revision!==version)return;
  stop().then(()=>{if(!enabled)message.textContent+=' Allow location access before going online.';});
 },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 heartbeat=setInterval(()=>publish(),20000);
};
onAuthStateChanged(auth,async next=>{
 const current=++authRevision;
 stop();stopJobs?.();stopJobs=null;user=null;application=null;point=null;pointAt=0;lastSent=0;busy=false;button.disabled=true;
 if(!next){message.textContent='Sign in as an approved driver to go online.';return;}
 const [profile,app]=await Promise.all([getDoc(doc(db,'users',next.uid)),getDoc(doc(db,'driverApplications','driver_'+next.uid))]).catch(()=>[]);
 if(current!==authRevision||auth.currentUser?.uid!==next.uid||!profile?.exists()||!app?.exists()||profile.data().role!=='driver'||!['approved','active'].includes(profile.data().accountStatus)||app.data().status!=='approved')return;
 user=next;application=app.data();
 // Remove an old online record even before this page obtains a GPS location.
 await publish(false);if(current!==authRevision)return;button.disabled=false;
 stopJobs=onSnapshot(query(collection(db,'rides'),where('driverId','==',next.uid)),snapshot=>{
  if(current!==authRevision)return;
  busy=snapshot.docs.some(job=>ACTIVE_STATUSES.includes(job.data().status));
  if(enabled){if(busy)setDriverOnline(false);publish();}
 },()=>{setDriverOnline(false);message.textContent='Unable to check assigned jobs. New jobs are paused.';});
});
document.getElementById('providerService')?.addEventListener('change',()=>{if(enabled)publish();});
window.addEventListener('pagehide',stop);
window.addEventListener('offline',()=>{setDriverOnline(false);message.textContent='Connection lost. New jobs are paused. Nearby visibility expires within 90 seconds.';});
window.addEventListener('online',()=>publish(enabled&&!busy));

window.addEventListener('fareride-go-online',()=>{if(!enabled&&!button.disabled)button.click();});
