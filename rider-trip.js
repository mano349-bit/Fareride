import {phoneNumber} from './ride-ui.js';
import {latestCurrentRide} from './ride-recovery.js';
import { riderProgress } from './rider-progress.js';
import { auth, db, doc, getDoc, onSnapshot, onAuthStateChanged, collection, query, where } from './firebase-config.js';
import { runTransaction } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { riderTripState } from './rider-trip-state.js';

const panel = document.createElement('section');
panel.style.cssText = 'padding:20px;margin:20px 0;border:1px solid #ccc;border-radius:12px;background:white';
panel.hidden = true;
panel.innerHTML = '<h2>Your Trip</h2><p id="tripStage"></p><p id="tripDetails" style="white-space:pre-line"></p><a id="tripCallDriver" hidden style="padding:12px 16px;margin:12px 0;background:#0875e1;color:white;border-radius:8px;font-weight:700;text-decoration:none">Call driver</a><div id="riderProgress"></div><button type="button" id="cancelTrip">Cancel Ride</button><p id="tripActionMessage" role="status"></p>';
document.querySelector('main').prepend(panel);
const stage = panel.querySelector('#tripStage'), cancel = panel.querySelector('#cancelTrip'), message = panel.querySelector('#tripActionMessage');
let stop = null, discovery=null, uid = null, id = null, currentRide = null, generation=0;
function clear() { stop?.(); stop = null; panel.hidden = true; currentRide = null; id = null; }
function watch(next) {
  if(!next){try{next=localStorage.getItem('fareride_last_ride_id');}catch{}}
  if (!uid || !next || next === id) return;
  clear(); id = next;
  const expected = uid;
  stop = onSnapshot(doc(db, 'rides', next), snapshot => {
    if(id!==next)return;
    if (auth.currentUser?.uid !== expected || !snapshot.exists() || snapshot.data().riderId !== expected) { clear(); return; }
    currentRide = {...snapshot.data(),id:next};
    const state = riderTripState(currentRide);
    panel.hidden = false; stage.textContent = state.message;
    panel.querySelector('#tripDetails').textContent='Job ID: '+next+'\nPickup: '+(currentRide.pickup||'')+'\nDestination: '+(currentRide.dropoff||'')+'\nDriver: '+(currentRide.driverName||'Waiting for assignment');
    const call=panel.querySelector('#tripCallDriver'),number=phoneNumber(currentRide.driverPhone);call.hidden=!number||state.finished;call.textContent='Call driver: '+(currentRide.driverPhone||'');if(number&&!state.finished)call.href='tel:'+number;else call.removeAttribute('href');
    window.dispatchEvent(new CustomEvent('fareride-ride-restored',{detail:currentRide}));
    panel.querySelector('#riderProgress').innerHTML = riderProgress(currentRide.status);
    cancel.hidden = !state.canCancel; cancel.disabled = false;
  }, () => { panel.hidden = false; stage.textContent = 'Unable to load your trip. Check account approval and ride permissions.'; cancel.hidden = true; });
}
function discover(){
 discovery?.();discovery=null;if(!uid)return;const expected=uid;
 discovery=onSnapshot(query(collection(db,'rides'),where('riderId','==',uid)),snapshot=>{
  if(auth.currentUser?.uid!==expected||uid!==expected)return;
  const active=latestCurrentRide(snapshot.docs.map(d=>({...d.data(),id:d.id})),uid,'rider');
  if(active){try{localStorage.setItem('fareride_last_ride_id',active.id);}catch{}watch(active.id);}
 },()=>{panel.hidden=false;stage.textContent='Unable to restore your current job. Check your connection and retry.';cancel.hidden=true;});
}
onAuthStateChanged(auth, async user => {
  const check=++generation;discovery?.();discovery=null;clear(); uid = null;
  if (!user) return;
  const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (check!==generation || auth.currentUser?.uid !== user.uid || !profile?.exists()) return;
  if (profile.data().role !== 'rider') return;
  uid = user.uid; discover();
});
cancel.onclick = async () => {
  if (!id || !currentRide || !riderTripState(currentRide).canCancel) return;
  if (!confirm('Cancel this ride?')) return;
  cancel.disabled = true; message.textContent = '';
  try {
    const rideId = id, riderId = uid;
    await runTransaction(db, async transaction => {
      const reference = doc(db, 'rides', rideId), snapshot = await transaction.get(reference);
      if (!snapshot.exists() || snapshot.data().riderId !== riderId || !riderTripState(snapshot.data()).canCancel) {
        throw new Error('This ride can no longer be cancelled.');
      }
      transaction.update(reference, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    });
    localStorage.removeItem('fareride_last_ride_id');
    window.dispatchEvent(new Event('fareride-new-ride'));
    message.textContent = 'Ride cancelled. You can request another ride.';
  } catch (error) { message.textContent = error.code === 'permission-denied' ? 'Cancellation is blocked by Firebase ride permissions.' : error.message; }
  finally { cancel.disabled = false; }
};
window.addEventListener('fareride-new-ride',()=>watch());
window.addEventListener('storage', event => { if (event.key === 'fareride_last_ride_id') watch(); });
window.addEventListener('pagehide',()=>{discovery?.();discovery=null;clear();});
window.addEventListener('pageshow',event=>{if(event.persisted&&uid&&auth.currentUser?.uid===uid)discover();});

