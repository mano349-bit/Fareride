import {auth, db, doc, setDoc, collection, query, where, onAuthStateChanged} from './firebase-session.js';
import {getDocFromServer} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {shareDriverPhotos, PHOTO_RIDE_STATUSES} from './driver-photo-sharing.js';
let stop = null, epoch = 0;
const message = document.createElement('p');
message.setAttribute('role','status');
message.hidden = true;
(document.getElementById('driverControls') || document.querySelector('main')).append(message);
async function watchDriver(user) {
  const check = ++epoch;
  stop?.(); stop = null; message.hidden = true;
  if (!user) return;
  const uid = user.uid, jobs = new Map(), pending = new Set(), shared = new Set(), lastAttempt = new Map();
  const current = () => epoch === check && auth.currentUser?.uid === uid;
  const data = async reference => { const snapshot = await getDocFromServer(reference); return snapshot.exists() ? snapshot.data() : null; };
  const profile = await data(doc(db,'users',uid)).catch(()=>null);
  if (!current() || profile?.role !== 'driver') return;
  stop = liveSnapshot(query(collection(db,'rides'),where('driverId','==',uid)), snapshot => {
    if (!current()) return;
    jobs.clear();
    for (const item of snapshot.docs) {
      const ride = {...item.data(),id:item.id};
      if (ride.driverId === uid && PHOTO_RIDE_STATUSES.includes(ride.status)) jobs.set(ride.id,ride);
    }
    if (!jobs.size) { message.hidden = true; return; }
    for (const ride of jobs.values()) {
      if (pending.has(ride.id) || shared.has(ride.id) || Date.now() - (lastAttempt.get(ride.id) || 0) < 15000) continue;
      pending.add(ride.id); lastAttempt.set(ride.id,Date.now());
      const reference = doc(db,'rideDriverPhotos',ride.id);
      shareDriverPhotos({ride,uid,isCurrent:()=>current() && jobs.has(ride.id),
        readShared:()=>data(reference),
        readApplication:()=>data(doc(db,'driverApplications','driver_'+uid)),
        writeShared:photos=>setDoc(reference,photos)
      }).then(saved=>{
        if (saved && current()) { shared.add(ride.id); message.hidden = true; }
      }).catch(error=>{
        if (!current() || !jobs.has(ride.id)) return;
        message.hidden = false;
        message.textContent = String(error.code || '').includes('permission-denied')
          ? 'Your job is active, but photo sharing is blocked. The administrator must publish the driver photo Firestore rules.'
          : (error.message || 'Unable to share your driver photos. Check your connection.');
      }).finally(()=>pending.delete(ride.id));
    }
  },()=>{ if (current()) { message.hidden=false; message.textContent='Unable to check driver photo sharing. Check your connection.'; } });
}
onAuthStateChanged(auth,watchDriver);
window.addEventListener('pageshow',event=>{if(event.persisted)watchDriver(auth.currentUser);});
window.addEventListener('pagehide',()=>{epoch++;stop?.();stop=null;});
