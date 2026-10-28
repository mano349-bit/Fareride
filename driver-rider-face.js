import {auth, db, doc, collection, query, where, onAuthStateChanged} from './firebase-session.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {latestCurrentRide} from './ride-recovery.js?v=20261013-live-acceptance';
import {validRiderFace, canSeeRiderFace} from './rider-face-data.js';

const panel = document.createElement('section');
panel.className = 'card';
panel.hidden = true;
panel.setAttribute('aria-label', 'Rider face photo');
panel.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #ccc;border-radius:12px;background:white';
panel.innerHTML = `<h2>Your rider</h2>
<p data-rider-name></p>
<img data-rider-face hidden alt="Rider’s confirmed face portrait, cropped from their ID" style="width:220px;max-width:100%;height:auto;object-fit:contain;border-radius:10px;">
<p>The rider confirms this face crop from their own license or ID. The full document and its details stay private.</p>
<p role="status" aria-live="polite"></p>
<button type="button" hidden>Retry rider photo</button>`;
const image = panel.querySelector('[data-rider-face]');
const name = panel.querySelector('[data-rider-name]');
const status = panel.querySelector('[role="status"]');
const retry = panel.querySelector('button');
let uid = null, ride = null, key = null, epoch = 0, generation = 0;
let stopRides = null, stopPhoto = null;

function mount() {
  if (panel.isConnected) return true;
  const controls = document.querySelector('section[aria-label="Driver job controls"]');
  if (controls) { controls.after(panel); return true; }
  const main = document.querySelector('main');
  if (main) { main.prepend(panel); return true; }
  return false;
}
function clearPhoto() {
  generation++;
  stopPhoto?.(); stopPhoto = null; key = null;
  image.removeAttribute('src'); image.hidden = true;
  name.textContent = ''; status.textContent = ''; retry.hidden = true;
  panel.hidden = true;
}
function permitted() {
  return Boolean(uid && auth.currentUser?.uid === uid && canSeeRiderFace(ride, uid));
}
function show(next, force = false) {
  ride = next;
  if (!permitted()) { clearPhoto(); return; }
  if (!mount()) return;
  const nextKey = `${ride.id}:${ride.riderId}`;
  if (!force && key === nextKey) {
    name.textContent = ride.riderName || 'Rider';
    return;
  }
  clearPhoto(); key = nextKey;
  const expectedEpoch = epoch, expectedGeneration = generation, expectedUID = uid;
  const current = () => epoch === expectedEpoch && generation === expectedGeneration
    && uid === expectedUID && key === nextKey && permitted();
  panel.hidden = false; name.textContent = ride.riderName || 'Rider';
  status.textContent = 'Loading rider face photo…';
  const failed = error => {
    if (!current()) return;
    image.removeAttribute('src'); image.hidden = true;
    status.textContent = String(error?.code || '').includes('permission-denied')
      ? 'Rider photo access is blocked. The administrator must publish the rider face Firestore rules.'
      : 'Unable to load the rider face photo. Check your connection and retry.';
    retry.hidden = false;
  };
  try {
    stopPhoto = liveSnapshot(doc(db, 'riderFacePhotos', ride.id), snapshot => {
      if (!current()) return;
      const photo = snapshot.exists() ? snapshot.data() : null;
      retry.hidden = true;
      if (!photo || photo.riderId !== ride.riderId || !validRiderFace(photo.image)) {
        image.removeAttribute('src'); image.hidden = true;
        status.textContent = 'Waiting for rider to confirm their ID face photo.';
        return;
      }
      image.src = photo.image; image.hidden = false;
      status.textContent = 'Face photo is available while this job is active.';
    }, failed);
  } catch (error) { failed(error); }
}
function watchDriver(user) {
  const expectedEpoch = ++epoch;
  stopRides?.(); stopRides = null; ride = null; clearPhoto();
  uid = user?.uid || null;
  if (!uid) return;
  const expectedUID = uid;
  const current = () => epoch === expectedEpoch && uid === expectedUID && auth.currentUser?.uid === expectedUID;
  const failed = () => {
    if (!current()) return;
    ride = null; clearPhoto();
    if (!mount()) return;
    panel.hidden = false;
    status.textContent = 'Unable to load your active job for the rider face photo. Check your connection and retry.';
    retry.hidden = false;
  };
  try {
    stopRides = liveSnapshot(query(collection(db, 'rides'), where('driverId', '==', uid)), snapshot => {
      if (!current()) return;
      const rides = snapshot.docs.map(item => ({...item.data(), id:item.id}));
      show(latestCurrentRide(rides, expectedUID, 'driver'));
    }, failed);
  } catch { failed(); }
}
retry.onclick = () => permitted() ? show(ride, true) : watchDriver(auth.currentUser);
onAuthStateChanged(auth, watchDriver);
window.addEventListener('pagehide', () => watchDriver(null));
window.addEventListener('pageshow', event => { if (event.persisted) watchDriver(auth.currentUser); });
