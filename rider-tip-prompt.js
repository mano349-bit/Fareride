import {auth} from './firebase-session.js';

const opened = new Set();

export function openCompletedTip(ride) {
  const uid = auth.currentUser?.uid;

  if (
    !uid ||
    !ride ||
    ride.riderId !== uid ||
    ride.status !== 'completed' ||
    typeof ride.id !== 'string' ||
    !ride.id ||
    ride.id.includes('/') ||
    opened.has(ride.id)
  ) {
    return;
  }

  const key = 'fareride_feedback_opened_v2:' + uid + ':' + ride.id;

  try {
    if (sessionStorage.getItem(key)) return;
  } catch {}

  const url = new URL('rider-tip.html', location.href);
  url.searchParams.set('ride', ride.id);

  location.assign(url.href);
  opened.add(ride.id);

  try {
    sessionStorage.setItem(key, '1');
  } catch {}
}
