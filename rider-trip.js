import {openCompletedTip} from './rider-tip-prompt.js?v=20261026-rider-comment';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {phoneNumber} from './ride-ui.js';
import {latestCurrentRide} from './ride-recovery.js?v=20261013-live-acceptance';
import {
  auth,
  db,
  doc,
  getDoc,
  onSnapshot,
  onAuthStateChanged,
  collection,
  query,
  where
} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {riderTripState} from './rider-trip-state.js';

const panel = document.createElement('section');

panel.style.cssText =
  'padding:20px;margin:20px 0;border:1px solid #ccc;' +
  'border-radius:12px;background:white';

panel.hidden = true;

panel.innerHTML = `
  <h2>Your Trip</h2>
  <p id="tripStage" role="status" aria-live="polite"></p>

  <a
    id="tripCallDriver"
    hidden
    style="
      padding:12px 16px;
      margin:12px 0;
      background:#0875e1;
      color:white;
      border-radius:8px;
      font-weight:700;
      text-decoration:none
    "
  >Call driver</a>



  <button type="button" id="cancelTrip">
    Cancel Ride
  </button>

  <p id="tripActionMessage" role="status"></p>
`;

const rideForm = document.getElementById('rideForm');

if (rideForm) {
  rideForm.after(panel);
} else {
  document.querySelector('main').prepend(panel);
}

const stage = panel.querySelector('#tripStage');
const cancel = panel.querySelector('#cancelTrip');
const message = panel.querySelector('#tripActionMessage');

let stop = null;
let discovery = null;
let uid = null;
let id = null;
let currentRide = null;
let generation = 0;
const feedbackRide = new URLSearchParams(location.search).get('feedbackRide');

function clear() {
  stop?.();
  stop = null;
  panel.hidden = true;
  currentRide = null;
  id = null;
}

function watch(next) {
  if (!next) {
    try {
      next = localStorage.getItem('fareride_last_ride_id');
    } catch {}
  }

  if (!uid || !next || next === id) return;

  clear();
  id = next;

  const expected = uid;

  stop = liveSnapshot(
    doc(db, 'rides', next),
    {includeMetadataChanges:true},
    snapshot => {
      if (id !== next) return;

      if (
        auth.currentUser?.uid !== expected ||
        !snapshot.exists() ||
        snapshot.data().riderId !== expected
      ) {
        clear();
        return;
      }

      applyRide({
        ...snapshot.data(),
        id: next
      },!snapshot.metadata?.fromCache&&!snapshot.metadata?.hasPendingWrites);
    },
    () => {
      panel.hidden = false;
      stage.hidden=false;
      stage.textContent =
        'Unable to load your trip. Check account approval and ride permissions.';
      cancel.hidden = true;
    }
  );
}

function applyRide(nextRide,stageConfirmed=true) {
  if (
    !uid ||
    auth.currentUser?.uid !== uid ||
    nextRide.riderId !== uid ||
    nextRide.id !== id
  ) {
    return;
  }

  currentRide = nextRide;

  const state = riderTripState(currentRide);

  panel.hidden = false;
  stage.textContent = state.message;
  stage.hidden=true;

  const call = panel.querySelector('#tripCallDriver');
  const number = phoneNumber(currentRide.driverPhone);

  call.hidden = !number || state.finished;
  call.textContent =
    'Call driver: ' + (currentRide.driverPhone || '');

  if (number && !state.finished) {
    call.href = 'tel:' + number;
  } else {
    call.removeAttribute('href');
  }

  window.dispatchEvent(
    new CustomEvent('fareride-ride-restored', {
      detail: {...currentRide,stageConfirmed}
    })
  );



  cancel.hidden = !state.canCancel;
  cancel.disabled = false;
  openCompletedTip(currentRide, panel);
}

function discover() {
  discovery?.();
  discovery = null;

  if (!uid) return;

  const expected = uid;

  discovery = liveSnapshot(
    query(
      collection(db, 'rides'),
      where('riderId', '==', uid)
    ),
    {includeMetadataChanges:true},
    snapshot => {
      if (
        auth.currentUser?.uid !== expected ||
        uid !== expected
      ) {
        return;
      }

      const rides = snapshot.docs.map(document => ({
        ...document.data(),
        id: document.id
      }));

      const requestedFeedback = rides.find(ride => ride.id === feedbackRide && ride.status === 'completed');
      if (requestedFeedback) {
        watch(requestedFeedback.id);
        applyRide(requestedFeedback,!snapshot.metadata?.fromCache&&!snapshot.metadata?.hasPendingWrites);
        return;
      }

      const updatedCurrent = rides.find(ride => ride.id === id);
      if (updatedCurrent) applyRide(updatedCurrent,!snapshot.metadata?.fromCache&&!snapshot.metadata?.hasPendingWrites);

      const active = latestCurrentRide(
        rides,
        uid,
        'rider'
      );

      if (active) {
        try {
          localStorage.setItem(
            'fareride_last_ride_id',
            active.id
          );
        } catch {}

        watch(active.id);
        applyRide(active,!snapshot.metadata?.fromCache&&!snapshot.metadata?.hasPendingWrites);
      } else {
        let savedId;
        try { savedId = localStorage.getItem('fareride_last_ride_id'); } catch {}
        const completed = rides.find(ride => ride.id === (id || savedId) && ride.status === 'completed')
          || rides.filter(ride => ride.status === 'completed').sort((a,b) => {
            const time = ride => ride.completedAt?.toMillis?.() || new Date(ride.completedAt || ride.requestedAt || 0).getTime() || 0;
            return time(b) - time(a);
          })[0];
        if (completed) {
          watch(completed.id);
          applyRide(completed,!snapshot.metadata?.fromCache&&!snapshot.metadata?.hasPendingWrites);
        } else {
          watch();
        }
      }
    },
    () => {
      panel.hidden = false;
      stage.hidden=false;
      stage.textContent =
        'Unable to restore your current job. Check your connection and retry.';
      cancel.hidden = true;
    }
  );
}

onAuthStateChanged(auth, async user => {
  const check = ++generation;

  discovery?.();
  discovery = null;

  clear();
  uid = null;

  if (!user) return;

  const profile = await getDoc(
    doc(db, 'users', user.uid)
  ).catch(() => null);

  if (
    check !== generation ||
    auth.currentUser?.uid !== user.uid ||
    !profile?.exists()
  ) {
    return;
  }

  if (profile.data().role !== 'rider') return;

  uid = user.uid;
  discover();
});

cancel.onclick = async () => {
  if (
    !id ||
    !currentRide ||
    !riderTripState(currentRide).canCancel
  ) {
    return;
  }

  if (!confirm('Cancel this ride?')) return;

  cancel.disabled = true;
  message.textContent = '';

  try {
    const rideId = id;
    const riderId = uid;

    await runTransaction(db, async transaction => {
      const reference = doc(db, 'rides', rideId);
      const snapshot = await transaction.get(reference);

      if (
        !snapshot.exists() ||
        snapshot.data().riderId !== riderId ||
        !riderTripState(snapshot.data()).canCancel
      ) {
        throw new Error(
          'This ride can no longer be cancelled.'
        );
      }

      transaction.update(reference, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
    });

    localStorage.removeItem('fareride_last_ride_id');

    window.dispatchEvent(
      new Event('fareride-new-ride')
    );

    message.textContent =
      'Ride cancelled. You can request another ride.';
  } catch (error) {
    message.textContent =
      error.code === 'permission-denied'
        ? 'Cancellation is blocked by Firebase ride permissions.'
        : error.message;
  } finally {
    cancel.disabled = false;
  }
};

window.addEventListener(
  'fareride-new-ride',
  () => watch()
);

window.addEventListener('storage', event => {
  if (event.key === 'fareride_last_ride_id') {
    watch();
  }
});

window.addEventListener('pagehide', () => {
  discovery?.();
  discovery = null;
  clear();
});

window.addEventListener('pageshow', event => {
  if (
    event.persisted &&
    uid &&
    auth.currentUser?.uid === uid
  ) {
    discover();
  }
});
