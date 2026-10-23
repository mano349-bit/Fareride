import {auth} from './firebase-session.js';
import {canTip} from './rider-tip-state.js';
const opened = new Set();
export function openCompletedTip(ride) {
  const uid = auth.currentUser?.uid;
  if (!canTip(ride, uid) || !ride.id || opened.has(ride.id)) return;
  const key = 'fareride_tip_opened:' + uid + ':' + ride.id;
  try { if (sessionStorage.getItem(key)) return; } catch {}
  opened.add(ride.id);
  try { sessionStorage.setItem(key, '1'); } catch {}
  const url = new URL('rider-tip.html', location.href);
  url.searchParams.set('ride', ride.id);
  const popup = window.open(url.href, 'fareride-completed-tip', 'popup,width=480,height=680');
  if (popup) popup.focus();
  else location.assign(url.href);
}
