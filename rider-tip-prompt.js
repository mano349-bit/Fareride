import {auth,db,doc,onAuthStateChanged} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {canTip,tipValues} from './rider-tip-state.js';
let panel=null, currentId=null;
onAuthStateChanged(auth,()=>{panel?.remove();panel=null;currentId=null;});
export function openCompletedTip(ride, host = document.getElementById('riderProgress')?.closest('section')) {
 const uid=auth.currentUser?.uid;
 if(!uid||ride?.riderId!==uid||ride.status!=='completed'||!ride.id||ride.id.includes('/'))return;
 if(!host)return;
 host.hidden=false;
 if(currentId===ride.id&&panel?.isConnected){panel.hidden=false;return;}
 panel?.remove();
 panel=document.createElement('section');panel.className='card';
 panel.style.cssText='padding:20px;margin:16px 0;background:white;border:1px solid #cbd5e1;border-radius:12px';
 panel.innerHTML='<h3>Rate and tip your driver</h3><form><label>Driver rating (optional)<select name="rating"><option value="">Choose rating</option><option value="1">★ 1 star</option><option value="2">★★ 2 stars</option><option value="3">★★★ 3 stars</option><option value="4">★★★★ 4 stars</option><option value="5">★★★★★ 5 stars</option></select></label><fieldset style="border:0;padding:0"><label>Driver tip<select name="tip"><option value="0">No tip</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="custom">Custom percentage</option></select></label><label hidden>Custom tip (%)<input name="custom" type="number" min="0" max="100" step="0.1" value="0"></label><p data-preview aria-live="polite"></p><p>Tips go to the driver. This records the tip; no payment is charged here.</p></fieldset><button type="submit">Save rating and tip</button><button type="button" data-later>Not now</button></form><p role="status" aria-live="polite"></p>';
 host.append(panel);currentId=ride.id;
 const form=panel.querySelector('form'),rating=form.elements.namedItem('rating'),choice=form.elements.namedItem('tip'),custom=form.elements.namedItem('custom');
 const tipBox=form.querySelector('fieldset'),submit=form.querySelector('[type="submit"]'),status=panel.querySelector('[role="status"]');
 rating.value=ride.driverRating||'';
 const eligible=canTip(ride,uid);tipBox.hidden=!eligible;
 submit.textContent=eligible?'Save rating and tip':'Save rating';
 const percent=()=>choice.value==='custom'?custom.valueAsNumber:Number(choice.value);
 function preview(){
  custom.parentElement.hidden=choice.value!=='custom';custom.disabled=choice.value!=='custom';custom.required=!custom.disabled;
  try{const values=tipValues(ride.fare,percent());form.querySelector('[data-preview]').textContent='Tip: $'+values.tipAmount.toFixed(2)+' | Total: $'+values.totalFare.toFixed(2);}catch{form.querySelector('[data-preview]').textContent='Enter a percentage from 0 to 100.';}
 }
 choice.onchange=preview;custom.oninput=preview;if(eligible)preview();
 form.querySelector('[data-later]').onclick=()=>{panel.hidden=true;};
 form.onsubmit=async event=>{
  event.preventDefault();if(submit.disabled||auth.currentUser?.uid!==uid||!form.reportValidity())return;
  const selectedRating=Number(rating.value)||null,selectedPercent=percent();
  submit.disabled=true;status.textContent='Saving…';
  try{
   await runTransaction(db,async transaction=>{
    if(auth.currentUser?.uid!==uid)throw Error('Sign in again before submitting.');
    const ref=doc(db,'rides',ride.id),snapshot=await transaction.get(ref),current=snapshot.exists()?snapshot.data():null;
    if(current?.riderId!==uid||current.status!=='completed')throw Error('Only your completed ride can be reviewed.');
    const values=canTip(current,uid)?tipValues(current.fare,selectedPercent):{};
    if(selectedRating!==null)values.driverRating=selectedRating;
    if(Object.keys(values).length)transaction.update(ref,values);
   });
   if(auth.currentUser?.uid!==uid)return;
   form.hidden=true;status.textContent='Thank you! Your choices have been saved.';
  }catch(error){status.textContent=error.message||'Unable to save. Please retry.';submit.disabled=false;}
 };
 panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
