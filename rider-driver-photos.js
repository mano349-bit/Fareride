import {auth, db, doc, onAuthStateChanged} from './firebase-session.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {canShowDriverPhotos, validDriverPhoto} from './driver-photos.js';

const panel = document.createElement('section');
panel.hidden = true;
panel.setAttribute('aria-label', 'Identify your driver and vehicle');
panel.innerHTML = `<h3>Your driver and vehicle</h3>
<p>Match the driver, vehicle and plate before getting in. These photos are available until your ride ends.</p>
<div style="display:flex;flex-wrap:wrap;gap:16px">
<figure style="margin:0;flex:1;min-width:220px"><img alt="Front of your driver's vehicle showing the license plate" style="width:100%;max-height:360px;object-fit:contain"><figcaption>A — Front Image of Vehicle</figcaption></figure>
<figure style="margin:0;flex:1;min-width:220px"><img alt="Your driver's head-and-shoulders photo" style="width:100%;max-height:360px;object-fit:contain"><figcaption>B — Face Image (Passport-Style Photo)</figcaption></figure>
</div><p data-plate></p><p role="status"></p><button type="button" hidden>Retry photos</button>`;
let current = null, key = null, generation = 0, stop = null;
function clear() {
  generation++;
  stop?.(); stop = null;
  key = null;
  panel.hidden = true;
  panel.querySelectorAll('img').forEach(image => image.removeAttribute('src'));
  panel.querySelector('[data-plate]').textContent = '';
  panel.querySelector('button').hidden = true;
}
function show(ride) {
  current = ride;
  if (!canShowDriverPhotos(ride, auth.currentUser?.uid)) { clear(); return; }
  const nextKey = `${ride.id}:${ride.driverId}`;
  if (key === nextKey) return;
  clear(); key = nextKey;
  const check = generation, uid = auth.currentUser.uid;
  const host = document.getElementById('riderTripPanel');
  if (!host) return;
  host.append(panel); panel.hidden = false;
  const status = panel.querySelector('[role="status"]');
  status.textContent = 'Loading driver and vehicle photos…';
  try {
    stop = liveSnapshot(doc(db, 'rideDriverPhotos', ride.id), snapshot => {
    if (generation !== check || auth.currentUser?.uid !== uid || !canShowDriverPhotos(current, uid)) return;
    panel.querySelector('button').hidden = true;
    const photos = snapshot.exists() ? snapshot.data() : null;
    if (!photos || photos.driverId !== ride.driverId || !validDriverPhoto(photos.portrait) || !validDriverPhoto(photos.vehicle)) {
      panel.querySelectorAll('img').forEach(image => image.removeAttribute('src'));
      panel.querySelector('[data-plate]').textContent = '';
      status.textContent = 'Waiting for your driver’s photos. They will appear here automatically when shared.';
      return;
    }
    const images = panel.querySelectorAll('img');
    images[0].src = photos.vehicle;
    images[1].src = photos.portrait;
    panel.querySelector('[data-plate]').textContent = 'Plate number: ' + photos.plateNumber;
    status.textContent = '';
    }, () => {
      if (generation !== check) return;
      panel.querySelectorAll('img').forEach(image => image.removeAttribute('src'));
      panel.querySelector('[data-plate]').textContent = '';
      status.textContent = 'Unable to load driver photos. Check your connection or contact the administrator.';
      panel.querySelector('button').hidden = false;
    });
  } catch {
    if (generation !== check) return;
    status.textContent = 'Unable to load driver photos. Check your connection and retry.';
    panel.querySelector('button').hidden = false;
  }
}
panel.querySelector('button').onclick = () => { key = null; show(current); };
window.addEventListener('fareride-ride-restored', event => show(event.detail));
window.addEventListener('fareride-clear-trip', () => { current = null; clear(); });
window.addEventListener('pagehide', () => { current = null; clear(); });
onAuthStateChanged(auth, () => { current = null; clear(); });
