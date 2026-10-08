import { auth, db } from "./firebase-session.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDocFromServer } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const requiredRole = window.location.pathname.toLowerCase().includes('driver') ? 'driver' : 'rider';
const loginPage = './' + requiredRole + '-login.html';
let generation = 0, retryTimer;
const notice = document.createElement('div');
notice.setAttribute('role', 'status');
notice.hidden = true;
notice.style.cssText = 'padding:12px;background:#fff4d6;color:#553b00;text-align:center';
document.body.prepend(notice);
function report(text) { notice.textContent = text; notice.hidden = !text; }
function retry(check) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (check === generation && auth.currentUser) verify(auth.currentUser, check); }, 15000);
}
async function verify(user, check) {
  if (navigator.onLine === false) {
    report('You are offline. Your login is retained. Account access will be checked when you reconnect.');
    retry(check); return;
  }
  try {
    // A cache-only missing document is not proof that the account was removed.
    const snapshot = await getDocFromServer(doc(db, 'users', user.uid));
    if (check !== generation || auth.currentUser?.uid !== user.uid) return;
    if (!snapshot.exists()) {
      report('Your login is retained, but your FareRide profile is unavailable. Please contact FareRide Admin.');
      retry(check); return;
    }
    const profile = snapshot.data();
    const role = String(profile.role || '').trim().toLowerCase();
    const status = String(profile.accountStatus || profile.status || '').trim().toLowerCase();
    const approved = profile.approved === true || ['approved', 'active'].includes(status);
    if (['suspended', 'deleted', 'rejected', 'disabled'].includes(status) || (!user.emailVerified && !approved) || role !== requiredRole) {
      window.location.replace(loginPage + '?reason=account-access'); return;
    }
    report('');
  } catch (error) {
    if (check !== generation || auth.currentUser?.uid !== user.uid) return;
    console.warn('FareRide account check will retry:', error.code || error.message);
    report('Connection interrupted. Your login is retained. Reconnecting to check account access…');
    retry(check);
  }
}
onAuthStateChanged(auth, user => {
  const check = ++generation;
  clearTimeout(retryTimer);
  // Firebase delivers this after restoring its persisted authentication state.
  if (!user) { window.location.replace(loginPage + '?reason=session-missing'); return; }
  return verify(user, check);
});
window.addEventListener('online', () => { if (auth.currentUser) { clearTimeout(retryTimer); verify(auth.currentUser, ++generation); } });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && auth.currentUser) { clearTimeout(retryTimer); verify(auth.currentUser, ++generation); }
});
