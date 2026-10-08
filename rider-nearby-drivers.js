import './rider-map-preview.js';
import {auth,db,collection,query,where,onSnapshot,onAuthStateChanged} from './firebase-session.js';
import {nearestDrivers} from './nearby-drivers-state.js';
import {validCoordinates} from './ride-details.js';
const panel=document.createElement('section');panel.className='card';panel.style.cssText='margin:20px auto;padding:20px';
panel.innerHTML='<h2>Nearest drivers within 20 miles</h2><p role="status">Share your location or calculate a pickup route to find nearby drivers.</p><ol></ol>';
const message=panel.querySelector('p'),list=panel.querySelector('ol');document.getElementById('riderPreviewMap')?.closest('section').after(panel);
let origin,drivers=[],stop,uid,mode='GPS location';
const service=()=>document.querySelector('[name="serviceType"]:checked')?.value||document.getElementById('serviceType')?.value||'ride';
function render(){
 list.replaceChildren();if(!uid||!validCoordinates(origin)){window.dispatchEvent(new CustomEvent("fareride-nearby-drivers",{detail:[]}));return;}
 const nearby=nearestDrivers(drivers,origin,service());window.dispatchEvent(new CustomEvent("fareride-nearby-drivers",{detail:nearby}));message.textContent=nearby.length?`${nearby.length} available drivers nearest to your ${mode}. Distances are straight-line estimates.`:`No available drivers within 20 miles of your ${mode}.`;
 for(const driver of nearby){const item=document.createElement('li');item.style.cssText='padding:12px;border-bottom:1px solid #cbd5e1';item.textContent=`${driver.driverName} — ${[driver.vehicleYear,driver.vehicleMake,driver.vehicleModel].filter(Boolean).join(' ')} — ${driver.miles.toFixed(1)} miles`;list.append(item);}
}
function search(point,label){
 if(!validCoordinates(point))return;origin=point;mode=label;stop?.();drivers=[];if(!uid)return;
 const radius=20/69;
 message.textContent='Finding nearby available drivers…';
 stop=onSnapshot(query(collection(db,'driverPresence'),where('lat','>=',Math.max(-90,point.lat-radius)),where('lat','<=',Math.min(90,point.lat+radius))),snapshot=>{drivers=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));render();},()=>{message.textContent='Nearby driver access is not enabled yet. Firebase rules need publishing.';list.replaceChildren();});
}
window.addEventListener('fareride-rider-position',event=>search(event.detail,'GPS location'));
window.addEventListener('fareride-pickup-location',event=>search(event.detail,'pickup location'));
document.addEventListener('change',render);setInterval(render,15000);
onAuthStateChanged(auth,user=>{stop?.();stop=null;drivers=[];uid=user?.uid;list.replaceChildren();if(uid&&origin)search(origin,mode);if(!uid){render();message.textContent='Sign in to see nearby available drivers.';}});
