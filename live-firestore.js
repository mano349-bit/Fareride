import {onSnapshot as listen} from './firebase-session.js';
import {getDocFromServer, getDocsFromServer} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {createLiveSubscriber} from './live-subscription.js?v=20261013-live-sync';
export const liveSnapshot=createLiveSubscriber({
 listen,
 read:reference=>reference.type==='document'?getDocFromServer(reference):getDocsFromServer(reference),
 visible:()=>!document.hidden,
 online:()=>navigator.onLine!==false,
 listenEvent:(name,callback)=>{
  const target=name==='visibilitychange'?document:window;
  target.addEventListener(name,callback);
  return ()=>target.removeEventListener(name,callback);
 }
});
