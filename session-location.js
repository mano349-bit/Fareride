import {auth,onAuthStateChanged} from './firebase-session.js';
// One permission-respecting GPS watch per signed-in page, shared by presence and trips.
const listeners=new Set();
let state={uid:null,position:null,error:null},watch=null,retry=null,generation=0;
function emit(next){state=next;for(const listener of listeners){try{listener(state);}catch(error){console.error('Location listener failed',error);}}}
export function observeSessionLocation(listener){listeners.add(listener);listener(state);return ()=>listeners.delete(listener);}
function stopWatch(){if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;clearTimeout(retry);retry=null;}
function start(){
 stopWatch();const uid=auth.currentUser?.uid,version=++generation;
 if(!uid){emit({uid:null,position:null,error:null});return;}
 if(!navigator.geolocation){emit({uid,position:null,error:{code:0,message:'GPS is unavailable on this device.'}});return;}
 const active=()=>version===generation&&auth.currentUser?.uid===uid;
 watch=navigator.geolocation.watchPosition(position=>{
  if(!active())return;emit({uid,position,error:null});
  if(location.pathname.endsWith('/rider.html'))window.dispatchEvent(new CustomEvent('fareride-rider-position',{detail:{lat:position.coords.latitude,lng:position.coords.longitude}}));
 },error=>{
  if(!active())return;emit({uid,position:null,error});
  if(error.code!==1)retry=setTimeout(()=>{if(active()&&!document.hidden)start();},10000);
 },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
onAuthStateChanged(auth,()=>{generation++;stopWatch();emit({uid:auth.currentUser?.uid||null,position:null,error:null});start();});
window.addEventListener('pagehide',()=>{generation++;stopWatch();emit({uid:auth.currentUser?.uid||null,position:null,error:null});});
window.addEventListener('pageshow',()=>{if(auth.currentUser&&watch===null)start();});
window.addEventListener('online',()=>{if(auth.currentUser)start();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&auth.currentUser)start();});
// Resume after the user changes site permission without needing an app toggle.
navigator.permissions?.query({name:'geolocation'}).then(permission=>{
 permission.addEventListener('change',()=>{if(auth.currentUser)start();});
}).catch(()=>{});
