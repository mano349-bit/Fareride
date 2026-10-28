import {riderTotal} from './toll-accounting.js';
import {auth,db,doc,getDoc,onAuthStateChanged} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {canTip,tipValues} from './rider-tip-state.js';
const form=document.getElementById('completedTipForm');
const status=document.getElementById('tipStatus');
const choice=document.getElementById('tipPercent');
const custom=document.getElementById('customTipPercent');
const submit=document.getElementById('submitCompletedTip');
const id=new URLSearchParams(location.search).get('ride');
let ride=null,uid=null,generation=0;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function home(){
  const url=new URL('rider.html',location.href).href;
  try {
    if(window.opener && !window.opener.closed && window.opener.location.origin===location.origin){
      window.opener.location.href=url;
      window.opener.focus();
      window.close();
    }
  } catch {}
  location.replace(url);
}
function preview(){
  const isCustom=choice.value==='custom';
  document.getElementById('customTipLabel').hidden=!isCustom;
  custom.required=isCustom;
  custom.disabled=!isCustom;
  try {
    const values=tipValues(ride.fare,isCustom?custom.valueAsNumber:Number(choice.value));
    document.getElementById('completedTipPreview').textContent='Tip: '+money(values.tipAmount)+' | Total: '+money(riderTotal({...ride,totalFare:values.totalFare}));
  } catch {document.getElementById('completedTipPreview').textContent='Enter a tip percentage from 0 to 100.';}
}
choice.onchange=preview;custom.oninput=preview;
onAuthStateChanged(auth,async user=>{
  const check=++generation;form.hidden=true;ride=null;uid=null;
  if(!user){status.textContent='Sign in to tip your driver.';return;}
  if(!id || id.includes('/')){status.textContent='No valid completed ride was selected.';return;}
  try {
    const snapshot=await getDoc(doc(db,'rides',id));
    if(check!==generation||auth.currentUser?.uid!==user.uid)return;
    if(!snapshot.exists()||snapshot.data().riderId!==user.uid){status.textContent='This ride is unavailable.';return;}
    const next=snapshot.data();
    if(next.status!=='completed'){status.textContent='Tipping is available after your ride ends.';return;}
    if(next.tipSubmitted || Number(next.tipAmount)>0){home();return;}
    if(!canTip(next,user.uid)){status.textContent='Tipping is unavailable until the final fare is confirmed.';return;}
    uid=user.uid;ride=next;
    document.getElementById('rideDetails').textContent='Driver: '+(ride.driverName||'Your driver')+' | '+(ride.pickup||'')+' to '+(ride.dropoff||'');
    status.textContent='Choose a tip or select No tip, then return to the app.';
    form.hidden=false;preview();
  } catch {status.textContent='Unable to load your ride. Refresh to retry.';}
});
form.onsubmit=async event=>{
  event.preventDefault();
  if(submit.disabled||!ride||auth.currentUser?.uid!==uid)return;
  if(!form.reportValidity())return;
  const percent=choice.value==='custom'?custom.valueAsNumber:Number(choice.value);
  submit.disabled=true;status.textContent='Saving your tip…';
  try {
    await runTransaction(db,async transaction=>{
      if(auth.currentUser?.uid!==uid)throw new Error('Sign in again before submitting.');
      const ref=doc(db,'rides',id),snapshot=await transaction.get(ref);
      const current=snapshot.exists()?snapshot.data():null;
      if(current?.riderId===uid&&current.status==='completed'&&(current.tipSubmitted||Number(current.tipAmount)>0))return;
      if(!canTip(current,uid))throw new Error('This completed ride is no longer eligible for a tip.');
      transaction.update(ref,tipValues(current.fare,percent));
    });
    if(auth.currentUser?.uid===uid)home();
  } catch(error) {
    status.textContent=error.code==='permission-denied'?'Tip was not saved. Check ride permissions and retry.':(error.message||'Tip was not saved. Please retry.');
    submit.disabled=false;
  }
};

