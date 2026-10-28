import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {tollUpdate,tollAmount,riderTotal} from './toll-accounting.js';
const panel=document.createElement('section');panel.className='card';
panel.innerHTML='<h2>Record a toll</h2><p>Choose the exact job below, agree on the amount with the rider, then save. All toll reimbursement goes to the driver.</p><form id="driverTollForm"><label>Job<select id="tollRide" required></select></label><p id="tollSelectedJob" style="padding:12px;background:white;color:#0754b6;border:2px solid #0754b6;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere"></p><label>Toll road / booth<input id="tollRoad" maxlength="200" required></label><label>Agreed toll amount ($)<input id="tollCharge" type="number" min="0.01" max="500" step="0.01" required></label><label><input id="tollCustomerAgreed" type="checkbox" style="width:26px;height:26px;margin:10px auto;accent-color:#075fd8;cursor:pointer" required> The customer and I agreed to this toll amount for the job shown above.</label><p id="tollAgreementNotice" role="alert" hidden style="font-size:18px;line-height:1.5;padding:12px;background:#fff7e6;color:#8a3b00;border:2px solid #e68a00;border-radius:8px">Please check this box if you want to proceed.</p><button type="submit">Save toll to this job</button><button id="addAnotherToll" type="button" hidden>Add another toll for this job</button></form><p id="tollSaveStatus" role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere"></p><div id="recordedRideTolls"></div>';
document.querySelector('main').append(panel);
const form=panel.querySelector('form'),select=panel.querySelector('#tollRide'),status=panel.querySelector('#tollSaveStatus'),jobInfo=panel.querySelector('#tollSelectedJob');
const button=form.querySelector('button'),road=panel.querySelector('#tollRoad'),charge=panel.querySelector('#tollCharge'),agreement=panel.querySelector('#tollCustomerAgreed');
const savedTolls=panel.querySelector('#recordedRideTolls'),another=panel.querySelector('#addAnotherToll'),notice=panel.querySelector('#tollAgreementNotice');
const requestedJob=new URLSearchParams(location.search).get('tollRide'),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let stop=null,stopTolls=null,generation=0,tollRevision=0,jobs=new Map(),pending=null,saving=false,requestedApplied=false;
notice.hidden=true;form.hidden=true;another.hidden=true;
agreement.setAttribute('aria-describedby','tollAgreementNotice');
agreement.addEventListener('invalid',event=>{event.preventDefault();notice.hidden=false;agreement.focus();});
agreement.addEventListener('change',()=>{notice.hidden=agreement.checked;});
function clearEntry(){road.value='';charge.value='';agreement.checked=false;notice.hidden=true;}
function syncJob(){
 const job=jobs.get(select.value);
 select.disabled=saving;button.disabled=saving||!job;another.disabled=saving||!job;
 for(const input of [road,charge,agreement])input.disabled=saving||!job;
 if(!job){jobInfo.textContent='Select a job before entering a toll.';return;}
 const when=job.completedAt||job.startedAt||job.requestedAt;
 const date=when?.toDate?when.toDate():new Date(when||NaN);
 jobInfo.textContent='Job ID: '+job.id+'\nRider: '+(job.riderName||job.riderId)+'\nPickup: '+(job.pickup||'Not recorded')+'\nDestination: '+(job.dropoff||'Not recorded')+'\nStatus: '+job.status+' | '+(Number.isFinite(date.getTime())?date.toLocaleString():'Date not recorded')+'\nSaved tolls for this job: '+money(tollAmount(job));
}
function watchTolls(){
 stopTolls?.();stopTolls=null;const version=++tollRevision,uid=auth.currentUser?.uid,jobId=select.value;
 savedTolls.replaceChildren();another.hidden=true;if(!uid||!jobs.has(jobId))return;
 stopTolls=onSnapshot(collection(db,'rides',jobId,'tollEvents'),snapshot=>{
  if(version!==tollRevision||auth.currentUser?.uid!==uid)return;savedTolls.replaceChildren();
  const records=snapshot.docs.map(item=>({...item.data(),id:item.id})).filter(item=>!['pending','rejected'].includes(item.status));
  another.hidden=!records.length;if(!records.length)return;
  const heading=document.createElement('h3');heading.textContent='Saved tolls for job '+jobId;const list=document.createElement('ul');
  for(const record of records){const li=document.createElement('li');li.textContent=record.location+' — '+money(Number(record.amount));list.append(li);}savedTolls.append(heading,list);
 },()=>{if(version===tollRevision)savedTolls.textContent='Individual toll entries could not be loaded for job '+jobId+'. This does not confirm whether a new toll was saved.';});
}
select.addEventListener('change',()=>{clearEntry();pending=null;syncJob();watchTolls();status.textContent=jobs.has(select.value)?'Tolls will be saved only to the job shown above.':'Select the correct job.';});
for(const input of [road,charge])input.addEventListener('input',()=>{agreement.checked=false;notice.hidden=true;});
another.onclick=()=>{clearEntry();road.focus();status.textContent='Enter another agreed toll for job '+select.value;};
onAuthStateChanged(auth,async user=>{
 const version=++generation;stop?.();stop=null;stopTolls?.();stopTolls=null;tollRevision++;jobs=new Map();pending=null;saving=false;requestedApplied=false;
 select.replaceChildren();savedTolls.replaceChildren();form.hidden=true;another.hidden=true;clearEntry();syncJob();status.textContent='Sign in as a driver to record tolls.';if(!user)return;
 try{
  const profile=await getDoc(doc(db,'users',user.uid));if(version!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;
  status.textContent='Loading your jobs…';
  stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',user.uid)),snapshot=>{
   if(version!==generation)return;const previous=select.value;
   const rides=snapshot.docs.map(item=>({...item.data(),id:item.id})).filter(job=>job.driverId===user.uid&&['started','arrived','completed'].includes(job.status))
    .sort((a,b)=>String(b.completedAt||b.startedAt||'').localeCompare(String(a.completedAt||a.startedAt||'')));
   jobs=new Map(rides.map(job=>[job.id,job]));select.replaceChildren();
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose the job for this toll';select.append(placeholder);
   for(const job of rides){const option=document.createElement('option');option.value=job.id;option.textContent=(job.riderName||'Rider')+' | '+(job.pickup||'Pickup')+' → '+(job.dropoff||'Destination')+' | '+job.id;select.append(option);}
   if(previous&&jobs.has(previous))select.value=previous;
   else if(!requestedApplied&&requestedJob&&jobs.has(requestedJob)){select.value=requestedJob;requestedApplied=true;}
   else select.value='';
   if(previous&&select.value!==previous&&!saving){clearEntry();pending=null;status.textContent='The selected job is no longer available. Choose the correct job again.';}
   form.hidden=!rides.length;syncJob();watchTolls();
   if(status.textContent==='Loading your jobs…')status.textContent=rides.length?'Choose the correct job before entering a toll.':'No ongoing or completed jobs available.';
  },()=>{if(version===generation){form.hidden=true;status.textContent='Jobs could not be loaded. No new toll has been saved by this form.';}});
 }catch{if(version===generation)status.textContent='Unable to verify driver access.';}
});
form.onsubmit=async event=>{
 event.preventDefault();if(saving||!form.reportValidity()||!auth.currentUser||!agreement.checked)return;
 const uid=auth.currentUser.uid,jobId=select.value,job=jobs.get(jobId),amount=charge.valueAsNumber,location=road.value.trim(),version=generation;
 if(!job){status.textContent='Select the correct job before saving.';return;}
 const fingerprint=JSON.stringify([uid,jobId,amount,location]);if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
 const id=pending.id;let confirmed=false;saving=true;syncJob();status.textContent='Saving '+money(amount)+' toll to job '+jobId+'…';
 try{
  const result=await runTransaction(db,async transaction=>{
   if(auth.currentUser?.uid!==uid)throw Error('Sign in again before saving.');
   const ref=doc(db,'rides',jobId),eventRef=doc(db,'rides',jobId,'tollEvents',id);
   const [ride,saved]=await Promise.all([transaction.get(ref),transaction.get(eventRef)]);
   if(!ride.exists())throw Error('The selected job no longer exists.');
   if(ride.data().driverId!==uid||ride.data().riderId!==job.riderId)throw Error('The job assignment changed. Select the job and confirm the agreement again.');
   if(saved.exists()){
    const record=saved.data();if(record.driverId!==uid||record.amount!==amount||record.location!==location)throw Error('This entry does not match the saved toll. Refresh and check the job before retrying.');
    return {tolls:tollAmount(ride.data()),total:riderTotal(ride.data())};
   }
   const toll={amount,location},update=tollUpdate(ride.data(),uid,toll,id);
   transaction.set(eventRef,{...toll,driverId:uid,riderId:ride.data().riderId,source:'driver-rider-agreed',customerAgreed:true,createdAt:serverTimestamp()});
   transaction.update(ref,update);return {tolls:update.tollsAmount,total:riderTotal({...ride.data(),...update})};
  });
  confirmed=true;
  if(version!==generation||auth.currentUser?.uid!==uid)return;
  pending=null;clearEntry();another.hidden=false;
  status.textContent='SAVED: '+money(amount)+' toll — '+location+'\nJob ID: '+jobId+'\nTotal saved tolls for this job: '+money(result.tolls)+(result.total===null?'':'\nRider total including tolls: '+money(result.total));
  if(job.status==='completed'){const link=document.createElement('a');link.href='Receipts/driver-receipts.html#'+encodeURIComponent('receipt-'+jobId);link.textContent='Open receipt for this job';link.style.cssText='display:block;margin-top:8px;font-weight:700';status.append(link);}
 }catch(error){
  if(version!==generation||auth.currentUser?.uid!==uid)return;
  status.textContent=confirmed?'SAVED: '+money(amount)+' toll for job '+jobId+'. Refresh to view the receipt.':error.code==='permission-denied'?'NOT SAVED for job '+jobId+'. Firebase denied the toll write. Publish the latest toll rules in the correct Firebase project. Your entry has been kept.':'SAVE NOT CONFIRMED for job '+jobId+'. '+(error.message||'Check your connection.')+' Check the saved entries or retry this same entry; the retry will not add it twice.';
 }finally{if(version===generation){saving=false;syncJob();}}
};
