import {auth,db,doc,getDoc,addDoc,collection,serverTimestamp} from './firebase-session.js';
import {getSOSLocation,sosError} from './sos-state.js';
const driver=location.pathname.endsWith('/driver.html');
const button=document.querySelector(driver?'.sos-button':'.rider-sos-button')||document.querySelector('[onclick*="SOS.send"]');
const result=document.getElementById(driver?'sosResult':'riderSosResult') || document.querySelector('[id*="SOSResult"]');
const fallback=document.createElement('a');fallback.href='tel:911';fallback.textContent='Call 911 now';fallback.style.cssText='display:inline-block;padding:12px 18px;background:#b42318;color:white;border-radius:8px;font-weight:bold;margin:12px';button?.after(fallback);
let busy=false;
async function sendSOS(){
 if(busy||!result)return;
 if(!auth.currentUser){result.textContent='Sign in to send a FareRide SOS alert. You can still call 911.';return;}
 if(!navigator.geolocation){result.textContent='This browser does not support location. Call 911 directly.';return;}
 if(!confirm('Send your current GPS location to FareRide administrators as an SOS alert? This does not contact emergency services.'))return;
 const user=auth.currentUser;busy=true;if(button)button.disabled=true;result.textContent='Getting your location (up to 15 seconds)...';
 try{
  const point=await getSOSLocation(navigator.geolocation);
  if(auth.currentUser?.uid!==user.uid)throw new Error('Account changed');
  const profile=await getDoc(doc(db,'users',user.uid));
  const source=driver?'driver':'rider';if(!profile.exists()||profile.data().role!==source)throw new Error('Account role mismatch');
  const record={type:'SOS',source,reporterId:user.uid,[source+'Id']:user.uid,[source+'Name']:String(profile.data().fullName||source),rideId:null,status:'active',...point,mapUrl:'https://www.google.com/maps?q='+point.latitude+','+point.longitude,createdAt:serverTimestamp()};
  const candidate=localStorage.getItem(driver?'fareride_active_driver_ride':'fareride_last_ride_id');
  if(candidate){try{const ride=await getDoc(doc(db,'rides',candidate));if(ride.exists()&&ride.data()[source+'Id']===user.uid&&['accepted','arrived','started','requested'].includes(ride.data().status))record.rideId=candidate;}catch{}}
  result.textContent='Sending SOS to FareRide...';
  let timer;try{await Promise.race([addDoc(collection(db,'emergencies'),record),new Promise((_,reject)=>{timer=setTimeout(()=>reject({code:'save-timeout'}),15000);})]);}finally{clearTimeout(timer);}
  result.replaceChildren();const message=document.createElement('strong');message.textContent='SOS recorded in FareRide. Administrator response is not guaranteed. Call 911 for emergency help.';const map=document.createElement('a');map.href=record.mapUrl;map.target='_blank';map.rel='noopener';map.textContent=' View recorded location';result.append(message,map);
 }catch(error){result.textContent=sosError(error)+' Call 911 directly if you need emergency help.';}
 finally{busy=false;if(button)button.disabled=false;}
}
if(button){button.removeAttribute('onclick');button.addEventListener('click',sendSOS);}
