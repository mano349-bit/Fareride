import { auth, db, doc, getDoc, onAuthStateChanged } from './firebase-session.js';

// Registration in another tab changes the shared Firebase session.
export function observeAdmin(callback) {
  let revision = 0;
  return onAuthStateChanged(auth, async user => {
    const current = ++revision;
    callback(false);
    if (!user) return;
    try {
      const record = await getDoc(doc(db, 'admins', user.uid));
      if (current === revision && auth.currentUser?.uid === user.uid) {
        callback(record.exists() && record.data().active === true);
      }
    } catch (error) {
      console.error('Unable to verify administrator access:', error);
    }
  });
}
