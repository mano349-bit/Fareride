import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {tollUpdate,tollAmount} from './toll-accounting.js';
const panel=document.createElement('section');panel.className='card';
panel.innerHTML='<h2>Record a toll</h2><p>Agree on the toll amount with the customer before adding it. The full agreed toll is added to the rider total and reimbursed 100% to you. FareRide takes no commission on tolls.</p><form id="driverTollForm"><label>Ride<select id="tollRide" required></select></label><label>Toll road / booth<input id="tollRoad" maxlength="200" required></label><label>Agreed toll amount ($)<input id="tollCharge" type="number" min="0.01" max="500" step="0.01" required></label><label><input id="tollCustomerAgreed" type="checkbox" style="width:auto" required> The customer and I agreed to this toll amount.</label><button type="submit">Add agreed toll to ride total</button><button id="addAnotherToll" type="button" hidden>Add another toll for this ride</button></form><div id="recordedRideTolls"></div><p id="tollSaveStatus" role="status"></p>';
document.querySelector('main').append(panel);
const form=panel.querySelector('form'),select=panel.querySelector('#tollRide'),status=panel.querySelector('#tollSaveStatus');
const button=form.querySelector('button'),road=panel.querySelector('#tollRoad'),charge=panel.querySelector('#tollCharge'),agreement=panel.querySelector('#tollCustomerAgreed');
const savedTolls=panel.querySelector('#recordedRideTolls'),another=panel.querySelector('#addAnotherToll');
let stop=null,stopTolls=null,generation=0,pending=null,tollRevision=0;
form.hidden=true;another.hidden=true;
function clearEntry(){road.value='';charge.value='';agreement.checked=false;}
another.onclick=()=>{clearEntry();road.focus();status.textContent='Enter the next toll for this same ride and confirm the customer agreement.';};
function watchTolls(){
 stopTolls?.();stopTolls=null;
 const version=++tollRevision,uid=auth.currentUser?.uid,rideId=select.value;
 savedTolls.replaceChildren();another.hidden=true;if(!uid||!rideId)return;
 stopTolls=onSnapshot(collection(db,'rides',rideId,'tollEvents'),snapshot=>{
  if(version!==tollRevision||auth.currentUser?.uid!==uid)return;
  savedTolls.replaceChildren();
  const records=snapshot.docs.map(item=>({...item.data(),id:item.id})).filter(item=>!['pending','rejected'].includes(item.status));
  another.hidden=!records.length;if(!records.length)return;
  const heading=document.createElement('h3');heading.textContent='Tolls added to this ride';const list=document.createElement('ul');
  for(const record of records){const item=document.createElement('li');item.textContent=record.location+' — $'+Number(record.amount).toFixed(2);list.append(item);}
  savedTolls.append(heading,list);
 },()=>{if(version===tollRevision)savedTolls.textContent='Unable to load individual toll entries. The saved ride total remains unchanged.';});
}
select.addEventListener('change',()=>{agreement.checked=false;watchTolls();});
for(const input of [road,charge])input.addEventListener('input',()=>{agreement.checked=false;});
onAuthStateChanged(auth,async user=>{
 const version=++generation;stop?.();stop=null;stopTolls?.();stopTolls=null;tollRevision++;
 select.replaceChildren();savedTolls.replaceChildren();form.hidden=true;another.hidden=true;pending=null;clearEntry();
 status.textContent='Sign in as a driver to record tolls.';if(!user)return;
 try{
  const profile=await getDoc(doc(db,'users',user.uid));if(version!==generation)return;
  if(!profile.exists()||profile.data().role!=='driver')return;
  stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',user.uid)),snapshot=>{
   if(version!==generation)return;
   const previous=select.value;select.replaceChildren();
   const rides=snapshot.docs.map(item=>({...item.data(),id:item.id})).filter(ride=>['started','arrived','completed'].includes(ride.status))
    .sort((a,b)=>String(b.completedAt||b.startedAt||'').localeCompare(String(a.completedAt||a.startedAt||'')));
   for(const ride of rides){const option=document.createElement('option');option.value=ride.id;option.textContent=(ride.riderName||'Rider')+' — '+(ride.pickup||'Pickup')+' — '+ride.id+' — tolls $'+tollAmount(ride).toFixed(2);select.append(option);}
   if([...select.options].some(option=>option.value===previous))select.value=previous;
   form.hidden=!rides.length;watchTolls();
   status.textContent=rides.length?'Record only tolls incurred during this ride.':'No ongoing or completed rides available.';
  },()=>{if(version===generation){form.hidden=true;status.textContent='Unable to load your rides.';}});
 }catch{if(version===generation)status.textContent='Unable to verify driver access.';}
});
form.onsubmit=async event=>{
 event.preventDefault();if(button.disabled||!form.reportValidity()||!auth.currentUser||!agreement.checked)return;
 const uid=auth.currentUser.uid,rideId=select.value,amount=charge.valueAsNumber,location=road.value.trim();
 const fingerprint=JSON.stringify([uid,rideId,amount,location]);if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
 const id=pending.id;button.disabled=true;status.textContent='Adding agreed toll…';
 try{
  await runTransaction(db,async transaction=>{
   if(auth.currentUser?.uid!==uid)throw Error('Sign in again.');
   const ref=doc(db,'rides',rideId),eventRef=doc(db,'rides',rideId,'tollEvents',id);
   const [ride,saved]=await Promise.all([transaction.get(ref),transaction.get(eventRef)]);
   if(saved.exists())return;if(!ride.exists())throw Error('Ride unavailable.');
   const toll={amount,location},update=tollUpdate(ride.data(),uid,toll,id);
   transaction.set(eventRef,{...toll,driverId:uid,riderId:ride.data().riderId,source:'driver-rider-agreed',customerAgreed:true,createdAt:serverTimestamp()});
   transaction.update(ref,update);
  });
  if(auth.currentUser?.uid!==uid)return;
  pending=null;clearEntry();another.hidden=false;
  status.textContent='Toll added to the total and receipts. Select “Add another toll for this ride” for the next crossing. You receive 100% of every toll.';
 }catch(error){
  if(auth.currentUser?.uid===uid)status.textContent=error.code==='permission-denied'?'Toll was not saved. Publish the toll database rules before using toll entry.':error.message||'Toll was not saved. Retry without changing the entry.';
 }finally{button.disabled=false;}
};
