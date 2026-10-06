import { auth, db, doc, getDoc, updateDoc, onAuthStateChanged, onSnapshot, serverTimestamp } from './firebase-config.js';
import { ACTIVE_STATUSES, validCoordinates } from './ride-details.js';

const isDriver = location.pathname.endsWith('/driver.html');
const key = isDriver ? 'fareride_active_driver_ride' : 'fareride_last_ride_id';
const section = document.createElement('section');
section.style.cssText = 'max-width:900px;margin:20px auto;padding:20px;background:white;border:1px solid #ccc;border-radius:12px';
section.hidden = true;
section.innerHTML = `<h2>${isDriver ? 'Rider and driver live map' : 'Your driver'}</h2><p id="liveDriverDetails"></p><a id="liveDriverPhone" hidden></a><p id="liveMapStatus"></p><button type="button" id="shareRideLocation">Share my live location</button><div id="rideLiveMap" style="height:320px;margin-top:16px"></div>`;
document.querySelector('main').append(section);
const status = section.querySelector('#liveMapStatus');
const button = section.querySelector('button');
let user = null, ride = null, rideId = null, stop = null, gps = null, lastSent = 0;
let map = null, riderMarker = null, driverMarker = null;
function stopGPS() {
  if (gps !== null) navigator.geolocation.clearWatch(gps);
  gps = null; button.disabled = false;
}
function reset() {
  stopGPS(); stop?.(); stop = null; ride = null; rideId = null;
  section.hidden = true;
  if (map) map.remove();
  map = riderMarker = driverMarker = null;
}
function marker(current, point, label, permanent = false) {
  if (!validCoordinates(point)) return current;
  const text = document.createElement('span'); text.textContent = label;
  if (current) { current.setLatLng([point.lat, point.lng]); current.setPopupContent(text); if (permanent) current.setTooltipContent(text.cloneNode(true)); return current; }
  const created = L.marker([point.lat, point.lng]).addTo(map).bindPopup(text);
  if (permanent) created.bindTooltip(text.cloneNode(true), { permanent: true, direction: 'top' });
  return created;
}
function render() {
  const active = ACTIVE_STATUSES.includes(ride.status);
  section.hidden = !active;
  if (!active) { stopGPS(); if (map) map.remove(); map = riderMarker = driverMarker = null; return; }
  const info = section.querySelector('#liveDriverDetails');
  info.textContent = isDriver ? `Rider: ${ride.riderName || 'Rider'}`
    : [ride.driverName || 'Driver', [ride.vehicleYear, ride.vehicleMake, ride.vehicleModel].filter(Boolean).join(' ')].join(' — ');
  const phone = section.querySelector('#liveDriverPhone');
  const number = String(ride.driverPhone || '').replace(/[^+\d]/g, '');
  phone.hidden = isDriver || !number;
  phone.textContent = `Call driver: ${ride.driverPhone || ''}`;
  phone.href = `tel:${number}`;
  const riderPoint = ride.riderLocation || ride.pickupLocation;
  const center = validCoordinates(riderPoint) ? riderPoint : ride.driverLocation;
  if (window.L && validCoordinates(center)) {
    if (!map) {
      map = L.map('rideLiveMap').setView([center.lat, center.lng], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    }
    riderMarker = marker(riderMarker, riderPoint, ride.riderLocation ? 'Rider location' : 'Pickup (rider GPS not shared)');
    const vehicle = [ride.vehicleYear, ride.vehicleMake, ride.vehicleModel].filter(Boolean).join(' ') || 'Vehicle details unavailable';
    driverMarker = marker(driverMarker, ride.driverLocation, (ride.driverName || 'Driver') + ' - ' + vehicle, true);
  }
  const stamp = isDriver ? ride.riderLocationUpdatedAt : ride.driverLocationUpdatedAt;
  const time = stamp?.toMillis?.() || 0;
  status.textContent = time ? `Other person last updated: ${new Date(time).toLocaleTimeString()}${Date.now() - time > 30000 ? ' (location may be stale)' : ''}` : 'Waiting for the other person to share GPS. Pickup is a fixed location.';
}
async function watch() {
  const id = localStorage.getItem(key);
  if (!user || !id || id === rideId) return;
  reset(); rideId = id;
  const expected = user.uid;
  stop = onSnapshot(doc(db, 'rides', id), snapshot => {
    if (auth.currentUser?.uid !== expected || !snapshot.exists()) { reset(); return; }
    const next = snapshot.data();
    if ((isDriver ? next.driverId : next.riderId) !== expected) { reset(); return; }
    ride = next; render();
  }, () => { reset(); status.textContent = 'Unable to access this ride.'; });
}
onAuthStateChanged(auth, async next => {
  reset(); user = null;
  if (!next) return;
  const profile = await getDoc(doc(db, 'users', next.uid)).catch(() => null);
  if (auth.currentUser?.uid !== next.uid || !profile?.exists()) return;
  const data = profile.data();
  if (data.role !== (isDriver ? 'driver' : 'rider') || !['approved', 'active'].includes(data.accountStatus)) return;
  user = next; watch();
});
button.onclick = () => {
  if (!user || !ride || !ACTIVE_STATUSES.includes(ride.status) || !navigator.geolocation) return;
  const id = rideId, uid = user.uid;
  button.disabled = true;
  gps = navigator.geolocation.watchPosition(async position => {
    if (auth.currentUser?.uid !== uid || rideId !== id || !ACTIVE_STATUSES.includes(ride?.status)) { stopGPS(); return; }
    if (Date.now() - lastSent < 5000) return;
    lastSent = Date.now();
    const point = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
    if (!validCoordinates(point)) return;
    try {
      await updateDoc(doc(db, 'rides', id), { [isDriver ? 'driverLocation' : 'riderLocation']: point,
        [isDriver ? 'driverLocationUpdatedAt' : 'riderLocationUpdatedAt']: serverTimestamp() });
    } catch { status.textContent = 'Location could not be shared. Check ride access.'; stopGPS(); }
  }, () => { status.textContent = 'Location unavailable. Allow location access and try again.'; stopGPS(); },
  { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
};
window.addEventListener('fareride-new-ride', watch);
window.addEventListener('fareride-active-ride', watch);
window.addEventListener('storage', event => { if (event.key === key) { if (!event.newValue) reset(); else watch(); } });
window.addEventListener('pagehide', reset);
