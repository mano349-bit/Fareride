import { riderProgress } from './rider-progress.js';
import { auth, db, doc, getDoc, onSnapshot, onAuthStateChanged } from './firebase-config.js';
import { runTransaction } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import { riderTripState } from './rider-trip-state.js';

const panel = document.createElement('section');
panel.style.cssText = 'padding:20px;margin:20px 0;border:1px solid #ccc;border-radius:12px;background:white';
panel.hidden = true;
panel.innerHTML = '<h2>Your Trip</h2><p id="tripStage"></p><div id="riderProgress"></div><button type="button" id="cancelTrip">Cancel Ride</button><p id="tripActionMessage" role="status"></p>';
document.querySelector('main').prepend(panel);
const stage = panel.querySelector('#tripStage'), cancel = panel.querySelector('#cancelTrip'), message = panel.querySelector('#tripActionMessage');
let stop = null, uid = null, id = null, currentRide = null;
function clear() { stop?.(); stop = null; panel.hidden = true; currentRide = null; id = null; }
function watch() {
  const next = localStorage.getItem('fareride_last_ride_id');
  if (!uid || !next || next === id) return;
  clear(); id = next;
  const expected = uid;
  stop = onSnapshot(doc(db, 'rides', next), snapshot => {
    if (auth.currentUser?.uid !== expected || !snapshot.exists() || snapshot.data().riderId !== expected) { clear(); return; }
    currentRide = snapshot.data();
    const state = riderTripState(currentRide);
    panel.hidden = false; stage.textContent = state.message;
    panel.querySelector('#riderProgress').innerHTML = riderProgress(currentRide.status);
    cancel.hidden = !state.canCancel; cancel.disabled = false;
  }, () => { panel.hidden = false; stage.textContent = 'Unable to load your trip. Check account approval and ride permissions.'; cancel.hidden = true; });
}
onAuthStateChanged(auth, async user => {
  clear(); uid = null;
  if (!user) return;
  const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (auth.currentUser?.uid !== user.uid || !profile?.exists()) return;
  if (profile.data().role !== 'rider') return;
  uid = user.uid; watch();
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
window.addEventListener('fareride-new-ride', watch);
window.addEventListener('storage', event => { if (event.key === 'fareride_last_ride_id') watch(); });
window.addEventListener('pagehide', clear);

