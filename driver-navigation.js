import './ride-live.js';
import {latestCurrentRide} from './ride-recovery.js';
import {auth,db,collection,query,where,onSnapshot,onAuthStateChanged} from './firebase-config.js';
import {ACTIVE_STATUSES} from './ride-details.js';
import {navigationLinks} from './ride-navigation.js';
const panel=document.createElement('section');panel.className='card';panel.hidden=true;
panel.style.cssText='padding:20px;margin:20px 0;background:white;border:1px solid #cbd5e1;border-radius:12px';
panel.innerHTML='<h2>Drive with navigation</h2><label>Navigate to <select><option value="pickup">Rider pickup</option><option value="dropoff">Ride destination</option></select></label><p class="navigation-address"></p><div style="display:flex;gap:12px;flex-wrap:wrap"><a data-app="google">Google Maps</a><a data-app="waze">Waze</a><a data-app="apple">Apple Maps</a></div><p>Navigation opens on a new page or in your selected maps app. Keep FareRide open to share live location; return to FareRide to update the ride stage.</p>';
const liveSection=document.querySelector('#rideLiveMap')?.closest('section');
if(liveSection)liveSection.before(panel);else document.querySelector('main').append(panel);
const selector=panel.querySelector('select');let ride=null,stop=null,currentUID=null,previousStage=null;
function render(){
 const links=ride&&navigationLinks(ride,selector.value);panel.hidden=!links;
 if(!links)return;
 panel.querySelector('.navigation-address').textContent=selector.value==='pickup'?ride.pickup:ride.dropoff;
 for(const link of panel.querySelectorAll('a')){link.href=links[link.dataset.app];link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='display:inline-block;padding:12px 16px;background:#0875e1;color:white;border-radius:8px;text-decoration:none;font-weight:700';}
}
selector.onchange=render;
onAuthStateChanged(auth,user=>{
 stop?.();stop=null;currentUID=user?.uid;ride=null;previousStage=null;render();if(!user)return;
 const uid=user.uid;
 stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',uid)),snapshot=>{
  if(currentUID!==uid)return;
  const job=latestCurrentRide(snapshot.docs.map(d=>({...d.data(),id:d.id})),uid,'driver');
  ride=job;const stage=ride?ride.id+':'+ride.status:null;
  if(stage!==previousStage){selector.value=ride?.status==='arrived'?'dropoff':'pickup';previousStage=stage;}render();
 },()=>{ride=null;render();});
});
