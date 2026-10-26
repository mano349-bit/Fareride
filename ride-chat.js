import {auth,db,doc,getDoc,collection,query,where,orderBy,onAuthStateChanged,addDoc,serverTimestamp} from './firebase-session.js';
import {limit} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {chatRide,canChat,chatText} from './ride-chat-state.js';
const role=location.pathname.endsWith('/driver.html')?'driver':'rider';
const panel=document.createElement('section');panel.className='card trip-chat';panel.hidden=true;
const heading=document.createElement('h2');heading.textContent='Live rider–driver chat';
const context=document.createElement('p'),status=document.createElement('p');status.setAttribute('role','status');
const log=document.createElement('div');log.className='trip-chat-log';log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Live rider and driver messages');log.tabIndex=0;
const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('textarea');label.textContent='Message your '+(role==='rider'?'driver':'rider');input.rows=2;input.maxLength=2000;input.required=true;label.append(input);
const send=document.createElement('button');send.type='submit';send.textContent='Send message';form.append(label,send);panel.append(heading,context,status,log,form);
const anchor=document.getElementById(role==='rider'?'tripStage':'driverControls')?.closest('section')||document.getElementById('rideForm');if(anchor)anchor.after(panel);else document.querySelector('main')?.append(panel);
const style=document.createElement('style');style.textContent='.trip-chat{padding:20px;border:1px solid #b9d5ff}.trip-chat-log{height:220px;overflow-y:auto;overflow-x:hidden;padding:12px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc}.trip-chat-log p{margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}.trip-chat-log .chat-driver{color:#087443}.trip-chat-log .chat-rider{color:#175cd3}.trip-chat-log time{display:block;font-size:12px;color:#475569}.trip-chat textarea{width:100%;min-height:80px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;resize:vertical}.trip-chat[hidden],.trip-chat form[hidden]{display:none}';document.head.append(style);
let uid=null,ride=null,stopRides=null,stopMessages=null,generation=0,busy=false,loaded=false;
const drafts=new Map();
function controls(){form.hidden=!canChat(ride,uid,role);send.disabled=busy;input.disabled=busy;}
function open(next){
 if(next?.id===ride?.id&&next?.driverId===ride?.driverId){ride=next;controls();if(!form.hidden&&loaded)status.textContent='Messages appear live. No refresh needed.';else if(ride?.driverId&&form.hidden)status.textContent='Job finished. Conversation is read-only.';return;}
 if(ride)drafts.set(ride.id,input.value);stopMessages?.();stopMessages=null;ride=next;log.replaceChildren();input.value=ride?drafts.get(ride.id)||'':'';loaded=false;panel.hidden=!ride;
 if(!ride)return;context.textContent=(ride.pickup||'Pickup')+' → '+(ride.dropoff||'Destination');controls();
 if(!ride.driverId){status.textContent='Live chat opens when a driver accepts your job.';return;}
 status.textContent='Loading conversation…';const selected=ride.id,expected=generation;
 stopMessages=liveSnapshot(query(collection(db,'rides',selected,'messages'),orderBy('createdAt','desc'),limit(100)),snapshot=>{
  if(expected!==generation||ride?.id!==selected)return;const bottom=log.scrollHeight-log.clientHeight-log.scrollTop<40,top=log.scrollTop,first=!loaded;
  loaded=true;log.replaceChildren();const messages=[...snapshot.docs].reverse();
  if(!messages.length){const p=document.createElement('p');p.textContent='No messages yet.';log.append(p);}
  for(const item of messages){const message=item.data(),p=document.createElement('p'),name=document.createElement('strong'),body=document.createElement('span');p.className=message.senderRole==='driver'?'chat-driver':'chat-rider';const who=message.senderRole==='driver'?'Driver':'Rider',full=ride[message.senderRole+'Name']||who;name.textContent=who+' '+String(full).trim().split(/\s+/)[0]+': ';body.textContent=message.text||'';p.append(name,body);const date=message.createdAt?.toDate?.();if(date){const stamp=document.createElement('time');stamp.dateTime=date.toISOString();stamp.textContent=date.toLocaleString();p.append(stamp);}log.append(p);}
  log.scrollTop=first||bottom?log.scrollHeight:top;status.textContent=canChat(ride,uid,role)?'Messages appear live. No refresh needed.':'Job finished. Conversation is read-only.';controls();
 },error=>{if(expected!==generation)return;log.replaceChildren();form.hidden=true;status.textContent=error.code==='permission-denied'?'Chat permissions are not enabled yet. Publish the updated Firebase rules.':'Unable to load chat. Check your connection.';});
}
form.onsubmit=async event=>{
 event.preventDefault();if(busy||!canChat(ride,uid,role)||auth.currentUser?.uid!==uid)return;
 let text;try{text=chatText(input.value);}catch(error){status.textContent=error.message;return;}
 const selected=ride.id,actor=uid,expected=generation;busy=true;controls();status.textContent='Sending…';
 try{await addDoc(collection(db,'rides',selected,'messages'),{senderId:actor,senderRole:role,text,createdAt:serverTimestamp()});if(expected===generation&&ride?.id===selected){input.value='';drafts.delete(selected);status.textContent='Message sent.';}}
 catch(error){if(expected===generation)status.textContent=error.code==='permission-denied'?'Unable to send. The job may have ended, or chat rules need publishing.':'Message not sent. Check your connection and retry.';}
 finally{if(expected===generation){busy=false;controls();}}
};
async function connect(user){
 const expected=++generation;stopRides?.();stopMessages?.();stopRides=stopMessages=null;uid=null;ride=null;busy=false;drafts.clear();input.value='';log.replaceChildren();panel.hidden=true;if(!user)return;
 const profile=await getDoc(doc(db,'users',user.uid)).catch(()=>null);if(expected!==generation||auth.currentUser?.uid!==user.uid||!profile?.exists()||profile.data().role!==role||!['approved','active'].includes(profile.data().accountStatus))return;
 uid=user.uid;stopRides=liveSnapshot(query(collection(db,'rides'),where(role+'Id','==',uid)),snapshot=>{if(expected===generation)open(chatRide(snapshot.docs.map(item=>({...item.data(),id:item.id})),uid,role));},()=>{if(expected===generation){stopMessages?.();stopMessages=null;log.replaceChildren();form.hidden=true;panel.hidden=false;status.textContent='Unable to find your job. Check account approval and connection.';}});
}
onAuthStateChanged(auth,connect);
window.addEventListener('pageshow',event=>{if(event.persisted)connect(auth.currentUser);});
window.addEventListener('pagehide',()=>{generation++;stopRides?.();stopMessages?.();});
