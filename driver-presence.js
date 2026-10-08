import {auth,db,doc,getDoc,setDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {validCoordinates,ACTIVE_STATUSES} from './ride-details.js';
const panel=document.createElement('section');panel.className='card';panel.style.cssText='padding:16px;margin:16px 0';
const heading=document.createElement('h3');heading.textContent='Available for nearby riders';
const button=document.createElement('button');button.type='button';button.textContent='Go online';button.disabled=true;button.style.cssText='padding:12px;background:#1473e6;color:white;border:0;border-radius:8px';
const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Go online to appear to riders within 20 miles. Allow GPS access.';
panel.append(heading,message,button);document.querySelector('main')?.prepend(panel);
let user,application,watch,heartbeat,stopJobs,point,busy=false,enabled=false,inFlight=false,lastSent=0,pointAt=0,pendingPublish=false;
async function publish(available=enabled&&!busy) {
 if(!user||!application||!validCoordinates(point)||auth.currentUser?.uid!==user.uid)return;
 if(inFlight){pendingPublish=true;return;}
 available=available && Date.now()-pointAt<=90000;
 inFlight=true;
 try {await setDoc(doc(db,'driverPresence',user.uid),{uid:user.uid,driverName:application.fullName,vehicleYear:application.vehicleYear,vehicleMake:application.vehicleMake,vehicleModel:application.vehicleModel,serviceType:document.getElementById('providerService').value,lat:point.lat,lng:point.lng,available,updatedAt:serverTimestamp()});lastSent=Date.now();}
 catch {message.textContent='Nearby availability could not update. Check your connection.';}
 finally {inFlight=false;if(pendingPublish){pendingPublish=false;publish();}}
}
function stop(){enabled=false;if(watch!=null)navigator.geolocation.clearWatch(watch);watch=null;clearInterval(heartbeat);heartbeat=null;button.textContent='Go online';publish(false);}
button.onclick=()=>{
 if(enabled){stop();message.textContent='Offline: you are not shown to nearby riders.';return;}
 if(!navigator.geolocation){message.textContent='GPS is unavailable.';return;}
 enabled=true;button.textContent='Go offline';message.textContent='Getting your location…';
 const sharingUID=user?.uid;
 watch=navigator.geolocation.watchPosition(position=>{if(!enabled||auth.currentUser?.uid!==sharingUID)return;pointAt=position.timestamp||Date.now();point={lat:position.coords.latitude,lng:position.coords.longitude};if(Date.now()-lastSent>15000)publish();message.textContent=busy?'On a ride: hidden from available-driver results.':'Online: nearby riders can see your name, vehicle and location.';},()=>{stop();message.textContent='Allow location access, then tap Go online.';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 heartbeat=setInterval(()=>publish(),20000);
};
onAuthStateChanged(auth,async next=>{
 stop();stopJobs?.();user=null;application=null;point=null;button.disabled=true;
 if(!next)return;
 const [profile,app]=await Promise.all([getDoc(doc(db,'users',next.uid)),getDoc(doc(db,'driverApplications','driver_'+next.uid))]).catch(()=>[]);
 if(auth.currentUser?.uid!==next.uid||!profile?.exists()||!app?.exists()||profile.data().role!=='driver'||!['approved','active'].includes(profile.data().accountStatus)||app.data().status!=='approved')return;
 user=next;application=app.data();button.disabled=false;
 stopJobs=onSnapshot(query(collection(db,'rides'),where('driverId','==',next.uid)),snapshot=>{busy=snapshot.docs.some(job=>ACTIVE_STATUSES.includes(job.data().status));if(enabled)publish();});
});
document.getElementById('providerService')?.addEventListener('change',()=>{if(enabled)publish();});
window.addEventListener('pagehide',stop);
window.addEventListener('offline',()=>{message.textContent='Connection lost. Nearby visibility expires automatically unless updates resume.';});
window.addEventListener('online',()=>{if(enabled)publish();});
