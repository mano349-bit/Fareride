import {observeSessionLocation} from './session-location.js';
import {gpsStageTracker} from './driver-gps-stages.js?v=20261026-gps-stages';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {latestCurrentRide} from './ride-recovery.js?v=20261013-live-acceptance';
import { auth, db, doc, getDoc, updateDoc, onAuthStateChanged, onSnapshot, serverTimestamp, collection, query, where } from './firebase-session.js';
import { ACTIVE_STATUSES, validCoordinates } from './ride-details.js';
import { phoneNumber, vehicleIcon } from './ride-ui.js';
const isDriver = location.pathname.endsWith('/driver.html');
const gpsStages=gpsStageTracker();let writingStage=false;
async function advanceGpsStage(position,id,uid){
 if(!isDriver||writingStage||rideId!==id||auth.currentUser?.uid!==uid||ride?.driverId!==uid)return;
 const nextStage=gpsStages.update({...ride,id},position);if(!nextStage)return;
 const previous=ride.status;writingStage=true;
 try{
  await runTransaction(db,async transaction=>{
   const ref=doc(db,'rides',id),snapshot=await transaction.get(ref);
   if(auth.currentUser?.uid!==uid||rideId!==id||!snapshot.exists()||snapshot.data().driverId!==uid||snapshot.data().status!==previous)return;
   const at=new Date().toISOString(),changes={status:nextStage};
   if(nextStage==='started'){changes.startedAt=at;changes.estimatedFinishAt=new Date(Date.now()+Math.max(0,Number(snapshot.data().durationMinutes)||0)*60000).toISOString();}
   if(nextStage==='arrived')changes.arrivedAt=at;
   if(nextStage==='completed')changes.completedAt=at;
   transaction.update(ref,changes);
  });
 }catch(error){status.textContent='GPS stage update could not be saved. Use Driver Job Controls or retry when connected.';console.warn('GPS stage update failed',error);}
 finally{writingStage=false;}
}
const section = document.createElement('section');
section.style.cssText = 'max-width:900px;margin:20px auto;padding:20px;background:white;border:1px solid #ccc;border-radius:12px';
section.hidden = true;
section.innerHTML = '<h2>Rider and driver live map</h2><p id="liveDriverDetails"></p><a id="liveDriverPhone" hidden></a><p id="liveMapStatus" role="status" style="margin:0"></p><button type="button" hidden>Retry location</button><div id="rideLiveMap" style="height:360px;margin-top:8px"></div>';
if(isDriver){
 const controls=document.querySelector('section[aria-label="Driver job controls"]');
 if(controls)controls.after(section);else document.querySelector('main').append(section);
}
else if(document.getElementById('riderMapSlot'))document.getElementById('riderMapSlot').append(section);
else document.querySelector('main').prepend(section);
const status = section.querySelector('#liveMapStatus'), button = section.querySelector('button');
{button.textContent='Retry location';button.hidden=true;button.style.cssText='padding:12px 16px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700';}
let user=null, profile=null, ride=null, rideId=null, stop=null, discovery=null, gps=null, lastSent=0, attempted=false;
let heartbeat=null,positionHandler=null;
let map=null, riderMarker=null, driverMarker=null, pickupMarker=null, contactAttempted=false, locationError='';
function stopGPS(){if(heartbeat!==null)clearInterval(heartbeat);heartbeat=null;positionHandler=null;if(gps!==null)gps();gps=null;button.disabled=false;}
function reset(){gpsStages.reset();stopGPS();stop?.();stop=null;ride=null;rideId=null;section.hidden=true;attempted=false;contactAttempted=false;lastSent=0;locationError='';button.hidden=true;map?.remove();map=riderMarker=driverMarker=pickupMarker=null;}
function marker(current,point,label,type){
 if(!validCoordinates(point))return current;
 const text=document.createElement('span');text.textContent=label;
 if(current){current.setLatLng([point.lat,point.lng]);current.setPopupContent(text);current.setTooltipContent(text.cloneNode(true));return current;}
 const icon=L.divIcon({html: type==='rider' ? '<span style="font-size:25px;color:#0875e1;background:white;border-radius:50%;padding:4px" aria-hidden="true">&#9679;</span>' : vehicleIcon(type),className:'fareride-map-icon',iconSize:[40,36],iconAnchor:[20,18]});
 return L.marker([point.lat,point.lng],{icon}).addTo(map).bindPopup(text).bindTooltip(text.cloneNode(true),{permanent:true,direction:type==='rider'?'bottom':'top',opacity:1});
}
function render(){
 const active=ACTIVE_STATUSES.includes(ride.status), waiting=!isDriver&&ride.status==='requested';section.hidden=!(active||waiting);if(!active&&!waiting){stopGPS();return;}
 const rawPhone=isDriver?ride.riderPhone:ride.driverPhone;
 const contact=String(rawPhone??'').trim();
 const number=/^[+\d().\s-]+$/.test(contact)?phoneNumber(contact):'';
 const details=section.querySelector('#liveDriverDetails');details.style.cssText='white-space:pre-line;padding:14px;background:#eff6ff;border:1px solid #aac8e6;border-radius:8px;font-weight:700';
 details.textContent=isDriver ? 'Rider: '+(ride.riderName||'Rider') : 'Driver: '+(ride.driverName||'Waiting for a driver to accept')+'\nVehicle: '+([ride.vehicleYear,ride.vehicleMake,ride.vehicleModel].filter(Boolean).join(' ')||'Waiting for vehicle details')+'\nTelephone: '+(number?contact:'Not provided')+'\nLocation: '+(validCoordinates(ride.driverLocation)?ride.driverLocation.lat.toFixed(5)+', '+ride.driverLocation.lng.toFixed(5):'Waiting for driver GPS — driver must allow location access and keep FareRide open.');
 const riderName = (!isDriver && profile?.fullName) || ride.riderName || 'Rider';
 const driverName = (isDriver && profile?.fullName) || ride.driverName || 'Driver';
 const phone=section.querySelector('#liveDriverPhone');
 phone.hidden=!number;phone.textContent=`Call ${isDriver?'rider':'driver'}: ${contact}`;phone.style.cssText='padding:12px 16px;margin:10px 0;background:#0875e1;color:white;border-radius:8px;font-weight:700;text-decoration:none';if(number)phone.href=`tel:${number}`;else phone.removeAttribute('href');
 const point=validCoordinates(ride.riderLocation)?ride.riderLocation:ride.pickupLocation;
 const center=validCoordinates(point)?point:ride.driverLocation;
 if(window.L){
  if(!map){map=L.map('rideLiveMap').setView(validCoordinates(center)?[center.lat,center.lng]:[39.5,-98.35],validCoordinates(center)?13:4);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);}
  map.invalidateSize?.();
  riderMarker=marker(riderMarker,point,riderName+(ride.riderLocation?' - live location':' - pickup, waiting for GPS'),'rider');
  driverMarker=marker(driverMarker,ride.driverLocation,[driverName,ride.vehicleYear,ride.vehicleMake,ride.vehicleModel].filter(Boolean).join(' - '),ride.serviceType||'ride');
  if(validCoordinates(ride.pickupLocation)){
   const text=document.createElement('span');text.textContent='Booked pickup: '+(ride.pickup||'Pickup address');
   if(!pickupMarker)pickupMarker=L.marker([ride.pickupLocation.lat,ride.pickupLocation.lng]).addTo(map).bindPopup(text).bindTooltip(text.cloneNode(true),{permanent:true,direction:'left',opacity:1});
   else pickupMarker.setLatLng([ride.pickupLocation.lat,ride.pickupLocation.lng]);
  }
  const visible=[riderMarker,driverMarker,pickupMarker].filter(Boolean);
  if(visible.length>1)map.fitBounds(L.latLngBounds(visible.map(marker=>marker.getLatLng())),{paddingTopLeft:[55,100],paddingBottomRight:[55,65],maxZoom:16});
 }
 if(waiting){status.textContent='Finding a driver. Your accepted driver will appear here automatically.';return;}
 status.textContent=locationError;
 if(isDriver){const message=document.getElementById('locationStatus');if(message)message.textContent=locationError||'Live location active';}
}
function watch(id){
 if(!user||!id||id===rideId)return;reset();rideId=id;const expected=user.uid;
 stop=liveSnapshot(doc(db,'rides',id),snapshot=>{
  if(rideId!==id)return;
  if(auth.currentUser?.uid!==expected||!snapshot.exists()){reset();return;}
  const next=snapshot.data();if(next[isDriver?'driverId':'riderId']!==expected){reset();return;}
  applyRide(next,id);
 },()=>{if(rideId!==id||auth.currentUser?.uid!==expected)return;locationError='Unable to access the live ride.';status.textContent=locationError;});
}
function applyRide(next,id){
 if(!user||auth.currentUser?.uid!==user.uid||rideId!==id||next[isDriver?'driverId':'riderId']!==user.uid)return;
 const newlyAccepted=ACTIVE_STATUSES.includes(next.status)&&!ACTIVE_STATUSES.includes(ride?.status);
 ride=next;render();
 if(newlyAccepted&&!isDriver)section.scrollIntoView?.({behavior:'smooth',block:'start'});
  if(!isDriver&&!contactAttempted&&ACTIVE_STATUSES.includes(ride.status)){
   contactAttempted=true;
   const name=profile.fullName||user.displayName||'Rider',phone=String(profile.phone||'');
   if(ride.riderName!==name||ride.riderPhone!==phone)updateDoc(doc(db,'rides',id),{riderName:name,riderPhone:phone}).catch(()=>{status.textContent='Unable to share your contact details. Retry after checking your profile.';});
  }
  if(!attempted&&(ACTIVE_STATUSES.includes(ride.status)||(!isDriver&&ride.status==='requested')))startLocation();
}
function discover(){
 discovery?.();if(!user)return;const discoveryUID=user.uid;
 discovery=liveSnapshot(query(collection(db,'rides'),where(isDriver?'driverId':'riderId','==',user.uid)),snapshot=>{
  if(auth.currentUser?.uid!==discoveryUID||user?.uid!==discoveryUID)return;
  const job=latestCurrentRide(snapshot.docs.map(d=>({...d.data(),id:d.id})),user.uid,isDriver?'driver':'rider');
  if(job){watch(job.id);applyRide(job,job.id);}else reset();
 },()=>{status.textContent='Unable to find your active ride.';});
}
onAuthStateChanged(auth,async next=>{
 discovery?.();discovery=null;reset();user=null;profile=null;if(!next)return;
 const saved=await getDoc(doc(db,'users',next.uid)).catch(()=>null);if(auth.currentUser?.uid!==next.uid||!saved?.exists())return;
 profile=saved.data();if(profile.role!==(isDriver?'driver':'rider'))return;
 user=next;discover();
});
function startLocation(){
 if(!user||!ride||(!ACTIVE_STATUSES.includes(ride.status)&&(isDriver||ride.status!=='requested'))||gps!==null)return;attempted=true;
 if(!navigator.geolocation){locationError='Location is unavailable on this device.';status.textContent=locationError;button.hidden=true;return;}
 const id=rideId,uid=user.uid;button.disabled=true;button.hidden=true;locationError='';
 positionHandler=async position=>{
  if(auth.currentUser?.uid!==uid||rideId!==id)return;
  if(!ACTIVE_STATUSES.includes(ride?.status)&&(isDriver||ride?.status!=='requested')){stopGPS();return;}
  if(Date.now()-lastSent<3000)return;lastSent=Date.now();const point={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy};if(!validCoordinates(point))return;
  ride[isDriver?'driverLocation':'riderLocation']=point;render();
  // Before assignment the rider position stays on this device, not in a public job.
  if(!ACTIVE_STATUSES.includes(ride.status))return;
  try{await updateDoc(doc(db,'rides',id),{[isDriver?'driverLocation':'riderLocation']:point,[isDriver?'driverLocationUpdatedAt':'riderLocationUpdatedAt']:serverTimestamp()});if(auth.currentUser?.uid!==uid||rideId!==id)return;locationError='';if(isDriver)await advanceGpsStage(position,id,uid);}
  catch{if(auth.currentUser?.uid!==uid||rideId!==id)return;locationError='Location could not be shared. Retrying automatically; contact FareRide Admin if this continues.';status.textContent=locationError;button.hidden=true;}
 };
 gps=observeSessionLocation(state=>{
  if(state.uid!==uid||auth.currentUser?.uid!==uid||rideId!==id)return;
  if(state.position){positionHandler?.(state.position);return;}
  if(state.error){locationError=state.error.code===1?'Allow location permission in your browser or device settings. Sharing resumes automatically.':'Location unavailable. Sharing retries automatically.';status.textContent=locationError;button.hidden=true;}
 });
 heartbeat=setInterval(()=>{if(!document.hidden&&rideId===id)render();},10000);
}
button.onclick=()=>{stopGPS();lastSent=0;startLocation();};
window.addEventListener('pageshow',event=>{if(event.persisted&&user)discover();});
window.addEventListener('pagehide',()=>{discovery?.();discovery=null;reset();});

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user&&ride&&ACTIVE_STATUSES.includes(ride.status)){stopGPS();lastSent=0;startLocation();}});


window.addEventListener('online',()=>{if(user&&ride&&ACTIVE_STATUSES.includes(ride.status)){stopGPS();lastSent=0;startLocation();}});
