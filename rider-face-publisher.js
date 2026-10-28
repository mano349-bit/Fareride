import {auth, db, doc, setDoc, collection, query, where, onAuthStateChanged} from './firebase-session.js';
import {getDocFromServer} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {createRiderFaceSharing} from './rider-face-sharing.js';

const message = document.createElement('p');
message.id = 'riderFaceSharingStatus';
message.setAttribute('role', 'status');
message.setAttribute('aria-live', 'polite');
message.hidden = true;
let epoch = 0, cleanups = [], sharing = null;
function mount() {
  if (message.isConnected) return;
  const form = document.getElementById('rideForm');
  if (form) form.after(message);
  else document.querySelector('main')?.prepend(message);
}
function status(text = '') { mount(); message.textContent = text; message.hidden = !text; }
function reset() {
  epoch++; sharing?.dispose(); sharing = null;
  for (const stop of cleanups) stop();
  cleanups = []; status();
}
function watchRider(user) {
  reset();
  if (!user) return;
  const uid = user.uid, check = epoch;
  const current = () => epoch === check && auth.currentUser?.uid === uid;
  let stopProfile = null, stopRides = null, faceError = '', rideError = '';
  let lastState = {kind:'idle'};
  const render = state => {
    lastState = state;
    if (!current()) return;
    if (faceError || rideError) { status(faceError || rideError); return; }
    if (state.kind === 'missing') status('Confirm a face-only crop from your license or ID to share it with your assigned driver.');
    else if (state.kind === 'error') status(String(state.error?.code || '').includes('permission-denied')
      ? 'Your job can continue, but rider face sharing is blocked. The administrator must publish the rider face Firestore rules.'
      : 'Unable to share your confirmed face photo. Sharing will retry when connected.');
    else if (state.kind === 'sharing') status('Sharing your confirmed face photo with your assigned driver…');
    else status();
  };
  const stopFaceSharing = () => {
    stopProfile?.(); stopProfile = null; stopRides?.(); stopRides = null;
    sharing?.dispose(); sharing = null;
  };
  cleanups.push(stopFaceSharing);
  cleanups.push(liveSnapshot(doc(db, 'users', uid), snapshot => {
    if (!current()) return;
    const account = snapshot.exists() ? snapshot.data() : null;
    if (account?.role !== 'rider' || !['approved', 'active'].includes(account.accountStatus)) {
      stopFaceSharing(); status(); return;
    }
    if (sharing) return;
    sharing = createRiderFaceSharing({uid, isCurrent:current,
      readShared:async id => {
        const record = await getDocFromServer(doc(db, 'riderFacePhotos', id));
        return record.exists() ? record.data() : null;
      },
      writeShared:(id, data) => setDoc(doc(db, 'riderFacePhotos', id), data),
      onState:render
    });
    stopProfile = liveSnapshot(doc(db, 'riderFaceProfiles', uid), face => {
      if (!current()) return;
      faceError = '';
      sharing?.setProfile(face.exists() ? face.data() : null);
    }, error => {
      if (!current()) return;
      faceError = String(error?.code || '').includes('permission-denied')
        ? 'Rider face sharing needs the updated Cloud Firestore rules. Contact the administrator.'
        : 'Unable to load your confirmed face photo. Check your connection.';
      sharing?.setProfile(null);
      render(lastState);
    });
    stopRides = liveSnapshot(query(collection(db, 'rides'), where('riderId', '==', uid)), rides => {
      if (!current()) return;
      rideError = '';
      sharing?.setRides(rides.docs.map(item => ({...item.data(), id:item.id})));
    }, () => {
      if (!current()) return;
      rideError = 'Unable to check your active job for face sharing. Check your connection.';
      sharing?.setRides([]);
      render(lastState);
    });
  }, () => { if (current()) { stopFaceSharing(); status('Unable to check your rider account for face sharing. Reconnect and retry.'); } }));
}
onAuthStateChanged(auth, watchRider);
window.addEventListener('online', () => watchRider(auth.currentUser));
window.addEventListener('pageshow', event => { if (event.persisted) watchRider(auth.currentUser); });
window.addEventListener('focus', () => watchRider(auth.currentUser));
window.addEventListener('pagehide', reset);
