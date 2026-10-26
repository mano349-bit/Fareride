import {auth, db, doc, getDoc, collection, query, where, orderBy, addDoc, serverTimestamp, onAuthStateChanged} from './firebase-session.js';
import {limit} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {observeAdmin} from './admin-session.js';
import {LIVE_CHAT_STATUSES} from './job-chat-state.js?v=20261026-job-chat';
import {mountJobChat} from './job-chat-view.js?v=20261026-job-chat';

const role = location.pathname.endsWith('/admin.html') ? 'admin' : location.pathname.endsWith('/driver.html') ? 'driver' : 'rider';
const host = document.getElementById('jobChat');
const transport = {
  watchSession(callback) {
    if (role === 'admin') return observeAdmin(active => callback(active && auth.currentUser ? {uid: auth.currentUser.uid, role} : null));
    let version = 0;
    const stop = onAuthStateChanged(auth, async user => {
      const current = ++version; callback(null); if (!user) return;
      try {
        const profile = await getDoc(doc(db, 'users', user.uid));
        if (current === version && auth.currentUser?.uid === user.uid && profile.exists() && profile.data().role === role) callback({uid: user.uid, role});
      } catch { /* Stay signed out of chat until this session can be verified. */ }
    });
    return () => {version++; stop();};
  },
  watchJobs(identity, next, error) {
    const source = identity.role === 'admin'
      ? query(collection(db, 'rides'), where('status', 'in', LIVE_CHAT_STATUSES))
      : query(collection(db, 'rides'), where(identity.role + 'Id', '==', identity.uid));
    return liveSnapshot(source, snapshot => next(snapshot.docs.map(item => ({...item.data(), id: item.id}))), error);
  },
  watchRide(id, next, error) {
    return liveSnapshot(doc(db, 'rides', id), snapshot => next(snapshot.exists() ? snapshot.data() : null), error);
  },
  watchMessages(id, next, error) {
    return liveSnapshot(query(collection(db, 'rides', id, 'messages'), orderBy('createdAt', 'desc'), limit(100)), snapshot => {
      next(snapshot.docs.map(item => ({...item.data(), id: item.id, pending: item.metadata.hasPendingWrites})).reverse());
    }, error);
  },
  sendMessage(id, message) {
    return addDoc(collection(db, 'rides', id, 'messages'), {...message, createdAt: serverTimestamp()});
  }
};
let chat;
if (host) chat = mountJobChat(host, transport);
window.addEventListener('pagehide', () => {chat?.destroy(); chat = null;});
window.addEventListener('pageshow', event => {if (event.persisted && host && !chat) chat = mountJobChat(host, transport);});
