import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {tollUpdate,tollAmount} from './toll-accounting.js';
const panel=document.createElement('section');panel.className='card';
panel.innerHTML='<h2>Record a toll</h2><p>Agree on the toll amount with the customer before adding it. The full agreed toll is added to the rider total and reimbursed 100% to you. FareRide takes no commission on tolls.</p><p>Automatic GPS toll detection is not connected. Record each crossing once.</p><form id="driverTollForm"><label>Ride<select id="tollRide" required></select></label><label>Toll road / booth<input id="tollRoad" maxlength="200" required></label><label>Agreed toll amount ($)<input id="tollCharge" type="number" min="0.01" max="500" step="0.01" required></label><label><input id="tollCustomerAgreed" type="checkbox" style="width:auto" required> The customer and I agreed to this toll amount.</label><button type="submit">Add agreed toll to ride total</button></form><p id="tollSaveStatus" role="status"></p>';
document.querySelector('main').append(panel);
const form=panel.querySelector('form'),select=panel.querySelector('select'),status=panel.querySelector('#tollSaveStatus'),button=form.querySelector('button');
let stop=null,generation=0,pending=null;
onAuthStateChanged(auth,async user=>{
 const version=++generation;stop?.();stop=null;select.replaceChildren();form.hidden=true;status.textContent='Sign in as a driver to record tolls.';pending=null;
 if(!user)return;
 try{const profile=await getDoc(doc(db,'users',user.uid));if(version!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;
 stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',user.uid)),snapshot=>{
  if(version!==generation)return;const previous=select.value;select.replaceChildren();
  const rides=snapshot.docs.map(d=>({...d.data(),id:d.id})).filter(r=>['started','arrived','completed'].includes(r.status)).sort((a,b)=>String(b.completedAt||b.startedAt||'').localeCompare(String(a.completedAt||a.startedAt||'')));
  for(const ride of rides){const option=document.createElement('option');option.value=ride.id;option.textContent=(ride.riderName||'Rider')+' — '+(ride.pickup||'Pickup')+' — '+ride.id+' — tolls $'+tollAmount(ride).toFixed(2);select.append(option);}
  if([...select.options].some(o=>o.value===previous))select.value=previous;form.hidden=!rides.length;status.textContent=rides.length?'Record only tolls incurred during this ride.':'No ongoing or completed rides available.';
 },()=>{if(version!==generation)return;form.hidden=true;status.textContent='Unable to load your rides.';});
 }catch{if(version===generation)status.textContent='Unable to verify driver access.';}
});
form.onsubmit=async event=>{
 event.preventDefault();if(button.disabled||!form.reportValidity()||!auth.currentUser)return;
 const uid=auth.currentUser.uid,rideId=select.value,amount=panel.querySelector('#tollCharge').valueAsNumber,location=panel.querySelector('#tollRoad').value.trim();
 const fingerprint=JSON.stringify([uid,rideId,amount,location]);if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
 if(!panel.querySelector('#tollCustomerAgreed').checked)return;
 const id=pending.id;button.disabled=true;status.textContent='Adding agreed toll…';
 try{await runTransaction(db,async transaction=>{
  if(auth.currentUser?.uid!==uid)throw Error('Sign in again.');
  const ref=doc(db,'rides',rideId),eventRef=doc(db,'rides',rideId,'tollEvents',id);
  const [ride,saved]=await Promise.all([transaction.get(ref),transaction.get(eventRef)]);if(saved.exists())return;if(!ride.exists())throw Error('Ride unavailable.');
  const charge={amount,location};const update=tollUpdate(ride.data(),uid,charge,id);
  transaction.set(eventRef,{...charge,driverId:uid,source:'driver-rider-agreed',customerAgreed:true,riderId:ride.data().riderId,createdAt:serverTimestamp()});transaction.update(ref,update);
 });if(auth.currentUser?.uid!==uid)return;pending=null;panel.querySelector('#tollCharge').value='';panel.querySelector('#tollRoad').value='';panel.querySelector('#tollCustomerAgreed').checked=false;status.textContent='Agreed toll added to the ride total and receipts. You receive 100% of the toll amount.';
 }catch(error){status.textContent=error.code==='permission-denied'?'Toll was not saved. FareRide Admin must publish the toll database rules before toll entry can be used.':error.message||'Toll was not saved. Retry without changing the entry to avoid duplicates.';}
 finally{button.disabled=false;}
};

for(const input of [select,panel.querySelector('#tollCharge'),panel.querySelector('#tollRoad')])input.addEventListener('input',()=>{panel.querySelector('#tollCustomerAgreed').checked=false;});
