import {STATES,RIDE_RULES,SALES_SOURCE,TAX_REVIEWED,detectTaxJurisdiction,taxRecord,tableTaxPreview,TAX_TABLE_SOURCE,stateCode} from '../ride-tax.js';
import {auth,db,doc} from '../firebase-session.js';
import {runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
export function receiptTaxEditor(ride,{onPreview=()=>{},readOnly=false}={}){
 const section=document.createElement('section');section.className='receipt-tax-editor';
 section.style.cssText='padding:16px;margin:16px 0;background:#f4f7fb;border:1px solid #0754b6;border-radius:8px';
 const heading=document.createElement('h3');heading.textContent='Tax jurisdiction & rate';section.append(heading);
 const label=(text,input)=>{const el=document.createElement('label');el.style.cssText='display:block;margin:10px 0';el.append(document.createTextNode(text+' '),input);section.append(el);return el;};
 const state=document.createElement('select');state.required=true;state.setAttribute('aria-label','Tax state');
 for(const [value,text]of [['','Select a state'],...STATES.map(([code,name])=>[code,name]),['OTHER','Outside USA / custom jurisdiction']]){const option=document.createElement('option');option.value=value;option.textContent=text;state.append(option);}
 label('USA state',state);
 const jurisdiction=document.createElement('input');jurisdiction.maxLength=120;jurisdiction.placeholder='Country / province / jurisdiction';const jurisdictionLabel=label('Outside USA',jurisdiction);jurisdictionLabel.hidden=true;
 const makeNumber=(text,value,max,step)=>{const input=document.createElement('input');input.type='number';input.min='0';input.max=String(max);input.step=step;input.value=value;input.style.maxWidth='180px';label(text,input);return input;};
 const rate=makeNumber('Tax rate (%) — enter the applicable rate','',100,'0.0001');
 const base=makeNumber('Taxable amount (USD)',String(ride.fare??''),1000000,'0.01');
 const fixed=makeNumber('Additional fixed tax / fee (USD)','0',500,'0.01');
 const guidance=document.createElement('p'),source=document.createElement('a');source.target='_blank';source.rel='noopener noreferrer';section.append(guidance,source);
 const detection=document.createElement('p');detection.setAttribute('role','status');section.append(detection);
 const detect=document.createElement('button');detect.type='button';detect.textContent='Detect from saved trip GPS';section.append(detect);
 const preview=document.createElement('p');preview.setAttribute('aria-live','polite');section.append(preview);
 const confirmed=document.createElement('input');confirmed.type='checkbox';label('I verified the applicable tax, taxable amount and any local fees, and the rider agreed to this additional charge.',confirmed);
 const save=document.createElement('button');save.type='button';save.textContent='Save tax to this receipt';section.append(save);
 const message=document.createElement('p');message.setAttribute('role','status');section.append(message);
 let sourceKind='manual',selectionVersion=0;
 function updatePreview(){confirmed.checked=false;const values=[rate.value,base.value,fixed.value];const valid=values.every(v=>v.trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0);preview.textContent=valid?'Tax / fee preview: $'+(Math.round((Number(base.value)*Number(rate.value)/100+Number(fixed.value))*100)/100).toFixed(2):'Enter the applicable tax rate, including 0% when verified exempt.';
  try{onPreview(valid?tableTaxPreview(ride,state.value,{rate:rate.value,base:base.value,fixed:fixed.value,jurisdiction:jurisdiction.value}):null);}catch{onPreview(null);}
 }
 function select(){
  jurisdictionLabel.hidden=state.value!=='OTHER';confirmed.checked=false;
  const entry=STATES.find(s=>s[0]===state.value),rule=RIDE_RULES[state.value];
  rate.value=entry?String(entry[2]):'';fixed.value='0';
  guidance.textContent=entry?'Using '+entry[2]+'% from the uploaded State Tax Rate column (January 1, 2026). Local tax is not included. '+(rule?rule.note:'Ride-specific exemptions and fees may differ; verify before saving.'):'Enter the applicable rate for the country / jurisdiction. Amounts use this ride’s USD currency.';
  source.href='../tax-rates.html';source.textContent='View rates imported from '+TAX_TABLE_SOURCE.fileName;
  updatePreview();
 }
 state.onchange=()=>{selectionVersion++;sourceKind='manual';select();};
 for(const input of [rate,base,fixed,jurisdiction])input.addEventListener('input',updatePreview);
 detect.onclick=async()=>{
  const version=++selectionVersion;detect.disabled=true;detection.textContent='Checking saved pickup, rider and driver coordinates…';
  const result=await detectTaxJurisdiction(ride);
  detect.disabled=false;if(version!==selectionVersion||!section.isConnected)return;
  if(!result.selected){detection.textContent='Pickup GPS could not identify a jurisdiction. Select the state manually. Rider / driver positions alone do not establish the pickup tax jurisdiction.';return;}
  state.value=result.selected.country==='US'?(result.selected.state||''):'OTHER';if(state.value==='OTHER')jurisdiction.value=result.selected.country;
  sourceKind='pickup-gps';select();
  detection.textContent='Pickup: '+(result.selected.state||result.selected.country)+'. '+(result.conflict?'Rider / driver coordinates differ from pickup; verify the trip jurisdiction.':'Pickup determines this selection.')+' Saved locations checked: '+result.found.map(p=>p.kind+' '+(p.state||p.country)).join(', ')+'.';
 };
 save.onclick=async()=>{
  save.disabled=true;detect.disabled=true;
  try{
   const uid=auth.currentUser?.uid;
   const input={state:state.value,jurisdiction:jurisdiction.value,rate:rate.value,base:base.value,fixed:fixed.value,confirmed:confirmed.checked};
   // Validate before connecting, then revalidate the current document atomically.
   taxRecord(ride,uid,input);
   await runTransaction(db,async transaction=>{
    const ref=doc(db,'rides',ride.id),snapshot=await transaction.get(ref);
    if(!snapshot.exists()||auth.currentUser?.uid!==uid)throw Error('Ride or signed-in account changed. Reload the receipt.');
    const current=snapshot.data();if(current.fare!==ride.fare)throw Error('Fare changed. Reload and verify the tax again.');
    const record=taxRecord(current,uid,input);record.selection=sourceKind;
    transaction.update(ref,{rideTax:record,rideTaxRecordedAt:serverTimestamp()});
   });
   message.textContent='Tax saved. The receipt and PDF will update from the saved ride record.';
  }catch(error){message.textContent=error.code==='permission-denied'?'Tax could not be saved. Updated Firestore tax permissions must be deployed by the project owner.':error.message;save.disabled=false;detect.disabled=false;}
 };
 state.value=stateCode(ride.taxState||ride.pickupState)||'LA';
 if(readOnly){confirmed.parentElement.hidden=true;save.hidden=true;message.textContent='This is a calculation preview. Only the assigned driver can save verified tax to the ride record.';}
 select();
 detection.textContent='Default: Louisiana (5%) when no state is saved. Choose another state or use Detect from saved trip GPS to change it.';
 return section;
}
