import {latestCurrentRide} from './ride-recovery.js';
import {locationNotice} from './ride-location-notice.js';
import { auth, db, doc, getDoc, updateDoc, onAuthStateChanged, onSnapshot, serverTimestamp, collection, query, where } from './firebase-session.js';
import { ACTIVE_STATUSES, validCoordinates } from './ride-details.js';
import { phoneNumber, vehicleIcon } from './ride-ui.js';
const isDriver = location.pathname.endsWith('/driver.html');
const section = document.createElement('section');
section.style.cssText = 'max-width:900px;margin:20px auto;padding:20px;background:white;border:1px solid #ccc;border-radius:12px';
section.hidden = true;
section.innerHTML = '<h2>Rider and driver live map</h2><p id="liveDriverDetails"></p><a id="liveDriverPhone" hidden></a><p id="liveMapStatus" role="status"></p><p>Location shares automatically while this page is open. Allow location access when asked.</p><button type="button" hidden>Retry location</button><div style="position:relative;margin-top:16px"><div id="rideLiveMap" style="height:360px"></div><div id="rideMapPeople" aria-label="Rider and driver information" style="position:absolute;top:10px;right:10px;z-index:1000;max-width:75%;padding:10px 12px;background:white;border:1px solid #aac8e6;border-radius:8px;box-shadow:0 2px 8px #0002;white-space:pre-line;font-size:14px;pointer-events:none"></div></div>';
if(isDriver)document.querySelector('main').append(section);else document.querySelector('main').prepend(section);
const status = section.querySelector('#liveMapStatus'), button = section.querySelector('button');
if(!isDriver){button.textContent='Share my location';button.hidden=false;button.style.cssText='padding:12px 16px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700';}
let user=null, profile=null, ride=null, rideId=null, stop=null, discovery=null, gps=null, lastSent=0, attempted=false;
let heartbeat=null,positionHandler=null,sharingPaused=false;
let map=null, riderMarker=null, driverMarker=null, pickupMarker=null, contactAttempted=false, locationError='';
function stopGPS(){if(heartbeat!==null)clearInterval(heartbeat);heartbeat=null;positionHandler=null;if(gps!==null) navigator.geolocation.clearWatch(gps);gps=null;button.disabled=false;}
function reset(){stopGPS();stop?.();stop=null;ride=null;rideId=null;section.hidden=true;attempted=false;contactAttempted=false;lastSent=0;locationError='';button.hidden=isDriver;map?.remove();map=riderMarker=driverMarker=pickupMarker=null;}
function marker(current,point,label,type){
 if(!validCoordinates(point))return current;
 const text=document.createElement('span');text.textContent=label;
 if(current){current.setLatLng([point.lat,point.lng]);current.setPopupContent(text);current.setTooltipContent(text.cloneNode(true));return current;}
 const icon=L.divIcon({html: type==='rider' ? '<span style="font-size:25px;color:#0875e1;background:white;border-radius:50%;padding:4px" aria-hidden="true">&#9679;</span>' : vehicleIcon(type),className:'fareride-map-icon',iconSize:[40,36],iconAnchor:[20,18]});
 return L.marker([point.lat,point.lng],{icon}).addTo(map).bindPopup(text).bindTooltip(text.cloneNode(true),{permanent:true,direction:type==='rider'?'bottom':'top',opacity:1});
}
function render(){
 const active=ACTIVE_STATUSES.includes(ride.status);section.hidden=!active;if(!active){stopGPS();return;}
 const details=section.querySelector('#liveDriverDetails');details.style.cssText='white-space:pre-line;padding:14px;background:#eff6ff;border:1px solid #aac8e6;border-radius:8px;font-weight:700';
 details.textContent=isDriver ? 'Rider: '+(ride.riderName||'Rider') : 'Driver: '+(ride.driverName||'Waiting for driver details')+'\nVehicle: '+([ride.vehicleYear,ride.vehicleMake,ride.vehicleModel].filter(Boolean).join(' ')||'Waiting for vehicle details')+'\nTelephone: '+(ride.driverPhone||'Not provided')+'\nLocation: '+(validCoordinates(ride.driverLocation)?ride.driverLocation.lat.toFixed(5)+', '+ride.driverLocation.lng.toFixed(5):'Waiting for driver GPS — driver must allow location access and keep FareRide open.');
 const riderName = (!isDriver && profile?.fullName) || ride.riderName || 'Rider';
 const driverName = (isDriver && profile?.fullName) || ride.driverName || 'Driver';
 const vehicle = [ride.vehicleYear,ride.vehicleMake,ride.vehicleModel].filter(Boolean).join(' ');
 section.querySelector('#rideMapPeople').textContent = `Rider: ${riderName}\nDriver: ${driverName}${vehicle ? '\nVehicle: ' + vehicle : ''}`;
 const phone=section.querySelector('a'),raw=isDriver?ride.riderPhone:ride.driverPhone,number=phoneNumber(raw);
 phone.hidden=!number;phone.textContent=`Call ${isDriver?'rider':'driver'}: ${raw || ''}`;phone.style.cssText='padding:12px 16px;margin:10px 0;background:#0875e1;color:white;border-radius:8px;font-weight:700;text-decoration:none';if(number)phone.href=`tel:${number}`;else phone.removeAttribute('href');
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
 const age=stamp=>{const time=stamp?.toMillis?.()||0;return !time?'waiting for GPS':Date.now()-time>30000?'location stale — waiting for an update':'live';};
 status.textContent=locationError||'Rider: '+age(ride.riderLocationUpdatedAt)+' | Driver: '+age(ride.driverLocationUpdatedAt);const notice=locationNotice(ride);if(notice)status.textContent+=' | '+notice;
 if(isDriver){const message=document.getElementById('locationStatus');if(message)message.textContent=status.textContent;}
}
function watch(id){
 if(!user||!id||id===rideId)return;reset();rideId=id;const expected=user.uid;
 stop=onSnapshot(doc(db,'rides',id),snapshot=>{
  if(rideId!==id)return;
  if(auth.currentUser?.uid!==expected||!snapshot.exists()){reset();return;}
  const next=snapshot.data();if(next[isDriver?'driverId':'riderId']!==expected){reset();return;}
  ride=next;render();
  if(!isDriver&&!contactAttempted&&ACTIVE_STATUSES.includes(ride.status)){
   contactAttempted=true;
   const name=profile.fullName||user.displayName||'Rider',phone=String(profile.phone||'');
   if(ride.riderName!==name||ride.riderPhone!==phone)updateDoc(doc(db,'rides',id),{riderName:name,riderPhone:phone}).catch(()=>{status.textContent='Unable to share your contact details. Retry after checking your profile.';});
  }
  if(!attempted&&ACTIVE_STATUSES.includes(ride.status))startLocation();
 },()=>{if(rideId!==id||auth.currentUser?.uid!==expected)return;locationError='Unable to access the live ride.';status.textContent=locationError;});
}
function discover(){
 discovery?.();if(!user)return;const discoveryUID=user.uid;
 discovery=onSnapshot(query(collection(db,'rides'),where(isDriver?'driverId':'riderId','==',user.uid)),snapshot=>{
  if(auth.currentUser?.uid!==discoveryUID||user?.uid!==discoveryUID)return;
  const job=latestCurrentRide(snapshot.docs.map(d=>({...d.data(),id:d.id})),user.uid,isDriver?'driver':'rider');
  if(job)watch(job.id);else reset();
 },()=>{status.textContent='Unable to find your active ride.';});
}
onAuthStateChanged(auth,async next=>{
 discovery?.();discovery=null;reset();sharingPaused=false;user=null;profile=null;if(!next)return;
 const saved=await getDoc(doc(db,'users',next.uid)).catch(()=>null);if(auth.currentUser?.uid!==next.uid||!saved?.exists())return;
 profile=saved.data();if(profile.role!==(isDriver?'driver':'rider')||!['approved','active'].includes(profile.accountStatus))return;
 user=next;discover();
});
function startLocation(){
 if(!user||!ride||!ACTIVE_STATUSES.includes(ride.status)||gps!==null||sharingPaused)return;attempted=true;
 if(!navigator.geolocation){locationError='Location is unavailable on this device.';status.textContent=locationError;button.hidden=false;return;}
 const id=rideId,uid=user.uid;button.disabled=isDriver;button.hidden=isDriver;locationError='';
 positionHandler=async position=>{
  if(auth.currentUser?.uid!==uid||rideId!==id)return;
  if(!ACTIVE_STATUSES.includes(ride?.status)){stopGPS();return;}
  if(Date.now()-lastSent<3000)return;lastSent=Date.now();const point={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy};if(!validCoordinates(point))return;
  ride[isDriver?'driverLocation':'riderLocation']=point;render();
  try{await updateDoc(doc(db,'rides',id),{[isDriver?'driverLocation':'riderLocation']:point,[isDriver?'driverLocationUpdatedAt':'riderLocationUpdatedAt']:serverTimestamp()});if(auth.currentUser?.uid!==uid||rideId!==id)return;locationError='';}
  catch{if(auth.currentUser?.uid!==uid||rideId!==id)return;locationError='Location could not be shared. Check ride access.';status.textContent=locationError;stopGPS();button.hidden=false;}
 };
 gps=navigator.geolocation.watchPosition(positionHandler,error=>{if(auth.currentUser?.uid!==uid||rideId!==id)return;locationError=error.code===1?'Location permission denied. Allow location for this site, then retry.':'Location unavailable. Check device location settings and retry.';status.textContent=locationError;stopGPS();button.hidden=false;if(error.code!==1)setTimeout(()=>{if(auth.currentUser?.uid===uid&&rideId===id&&ACTIVE_STATUSES.includes(ride?.status)&&!document.hidden&&!sharingPaused)startLocation();},10000);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 heartbeat=setInterval(()=>{if(!document.hidden&&positionHandler&&rideId===id){render();navigator.geolocation.getCurrentPosition?.(positionHandler,()=>{render();},{enableHighAccuracy:true,maximumAge:0,timeout:10000});}},10000);
}
button.onclick=()=>{sharingPaused=false;stopGPS();lastSent=0;startLocation();};
window.addEventListener('pageshow',event=>{if(event.persisted&&user)discover();});
window.addEventListener('pagehide',()=>{discovery?.();discovery=null;reset();});

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!sharingPaused&&user&&ride&&ACTIVE_STATUSES.includes(ride.status)){stopGPS();lastSent=0;startLocation();}});

window.addEventListener('fareride-start-location',()=>{if(!isDriver)return;sharingPaused=false;if(user&&ride&&ACTIVE_STATUSES.includes(ride.status)){stopGPS();lastSent=0;startLocation();render();section.scrollIntoView?.({behavior:'smooth',block:'start'});}else{const message=document.getElementById('locationStatus');if(message)message.textContent='Accept a job first. The live map will show you and the rider until completion.';if(user)discover();}});
window.addEventListener('fareride-stop-location',()=>{if(isDriver){sharingPaused=true;stopGPS();locationError='Driver location sharing stopped. Click Start Live Location to resume.';if(ride)render();}});

window.addEventListener('online',()=>{if(user&&ride&&!sharingPaused&&ACTIVE_STATUSES.includes(ride.status)){stopGPS();lastSent=0;startLocation();}});
