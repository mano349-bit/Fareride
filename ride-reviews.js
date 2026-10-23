import {selectRiderReviews} from './rider-review-filter.js?v=20261013-rider-jobs';
import {localDay, completedInRange} from './rider-history-dates.js';
import {reviewWindow, driverReviewsInRange} from './driver-review-dates.js';
import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged,updateDoc} from './firebase-session.js';
const role=location.pathname.includes('driver')?'driver':'rider';
const section=document.createElement('section');section.className='card';section.style.cssText='background:white;padding:20px;margin:24px 0;border:1px solid #dbe3ee;border-radius:12px';
const heading=document.createElement('h2');heading.textContent=role==='rider'?'My rides, ratings and tips':'Rate your riders';const message=document.createElement('p');message.setAttribute('role','status');const jobs=document.createElement('div');section.append(heading,message,jobs);document.querySelector('main').append(section);
let stop=null,generation=0,refreshHistory=null;
const startDate=document.createElement('input'),endDate=document.createElement('input');
const riderDays=document.createElement('input'),riderLimit=document.createElement('select');
if(role==='driver'){
 const window=reviewWindow();
 const filters=document.createElement('div');filters.style.cssText='display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin:16px 0';
 const daysLabel=document.createElement('label');daysLabel.textContent='Past days (1–365)';
 const days=document.createElement('input');days.type='number';days.min='1';days.max='365';days.step='1';days.value='1';days.required=true;days.style.cssText='display:block;padding:10px;margin-top:6px;width:120px';daysLabel.append(days);filters.append(daysLabel);
 for(const [text,input,value] of [['Start date',startDate,window.start],['End date',endDate,window.end]]){
  const label=document.createElement('label');label.textContent=text;input.type='date';input.required=true;input.min=window.earliest;input.max=window.end;input.value=value;input.style.cssText='display:block;padding:10px;margin-top:6px';label.append(input);filters.append(label);
  input.onchange=()=>{days.value='';refreshHistory?.();};
 }
 days.onchange=()=>{
  const selected=reviewWindow(days.valueAsNumber);
  if(!selected){days.reportValidity();return;}
  startDate.value=selected.start;endDate.value=selected.end;
  startDate.min=endDate.min=selected.earliest;startDate.max=endDate.max=selected.end;
  refreshHistory?.();
 };
 const note=document.createElement('p');note.textContent='Showing today by default. Choose dates within the past 365 days.';
 section.insertBefore(filters,message);section.insertBefore(note,message);
}
if(role==='rider'){
 const window=reviewWindow(365);
 const filters=document.createElement('div');filters.style.cssText='display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin:16px 0';
 const daysLabel=document.createElement('label');daysLabel.textContent='Past days (1–365)';
 riderDays.type='number';riderDays.min='1';riderDays.max='365';riderDays.step='1';riderDays.value='365';riderDays.required=true;riderDays.setAttribute('aria-label','Rating history past days');riderDays.style.cssText='display:block;padding:10px;margin-top:6px;width:120px';daysLabel.append(riderDays);filters.append(daysLabel);
 for(const [text,input,value] of [['Start date',startDate,window.start],['End date',endDate,window.end]]){
  const label=document.createElement('label');label.textContent=text;input.type='date';input.required=true;input.min=window.earliest;input.max=window.end;input.value=value;input.style.cssText='display:block;padding:10px;margin-top:6px';label.append(input);filters.append(label);input.onchange=()=>{riderDays.value='';refreshHistory?.();};
 }
 riderDays.onchange=()=>{const selected=reviewWindow(riderDays.valueAsNumber);if(!selected){riderDays.reportValidity();return;}startDate.value=selected.start;endDate.value=selected.end;refreshHistory?.();};
 const countLabel=document.createElement('label');countLabel.textContent='Most recent jobs';riderLimit.setAttribute('aria-label','Rider jobs to show');riderLimit.style.cssText='display:block;padding:10px;margin-top:6px';
 for(const count of [1,2,3,5,10,20,50,100,'all']){const option=document.createElement('option');option.value=String(count);option.textContent=count==='all'?'All jobs':count+' '+(count===1?'job':'jobs');riderLimit.append(option);}riderLimit.value='1';riderLimit.onchange=()=>refreshHistory?.();countLabel.append(riderLimit);filters.append(countLabel);
 const today=document.createElement('button');today.type='button';today.textContent='Today';today.onclick=()=>{riderDays.value='1';startDate.value=endDate.value=localDay();refreshHistory?.();};filters.append(today);section.insertBefore(filters,message);
 const note=document.createElement('p');note.textContent='Showing your latest completed job by default. Choose 1–365 days and how many jobs to show. Your active job appears in Your Trip.';section.insertBefore(note,message);
 jobs.style.cssText='max-height:560px;overflow-y:auto;overflow-x:hidden';jobs.tabIndex=0;jobs.setAttribute('role','region');jobs.setAttribute('aria-label','Completed rider jobs; scroll to see more');
}

const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
onAuthStateChanged(auth,async user=>{const check=++generation;stop?.();stop=null;refreshHistory=null;jobs.replaceChildren();message.textContent='Sign in to review completed rides.';if(!user)return;try{const profile=await getDoc(doc(db,'users',user.uid));if(check!==generation||profile.data()?.role!==role)return;message.textContent='Loading completed rides...';stop=onSnapshot(query(collection(db,'rides'),where(role+'Id','==',user.uid)),snap=>{if(check!==generation)return;const allRides=snap.docs.map(d=>({...d.data(),id:d.id})).filter(r=>r.status==='completed');refreshHistory=()=>{jobs.replaceChildren();const selection=role==='rider'?selectRiderReviews(allRides,startDate.value,endDate.value,riderLimit.value):null;const rides=role==='rider'?selection?.rides??null:driverReviewsInRange(allRides,startDate.value,endDate.value);if(rides===null){message.textContent=role==='driver'?'Choose valid dates within the past 365 days, with the end date on or after the start date.':'Choose valid dates within the past 365 days, with the end date on or after the start date.';return;}message.textContent=rides.length?(role==='rider'?'Showing '+rides.length+' of '+selection.total+' completed job(s), newest first. ':rides.length+' completed ride(s). ')+'Choose 1 to 5 stars. Ratings can be updated.':'No completed rides in this date range.';for(const ride of rides){const card=document.createElement('div');card.style.cssText='padding:16px 0;border-bottom:1px solid #e5e7eb';const title=document.createElement('p');title.dataset.fitLongText='true';title.textContent=(role==='rider'?ride.driverName:ride.riderName)+' | '+ride.pickup+' to '+ride.dropoff;
const label=document.createElement('label');label.textContent=role==='rider'?'Driver rating ':'Rider rating ';const rating=document.createElement('select');rating.innerHTML='<option value="">Choose rating</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+' '+(n===1?'star':'stars')+'</option>').join('');rating.value=ride[role==='rider'?'driverRating':'riderRating']||'';label.append(rating);{const date=document.createElement('p');const completed=ride.completedAt?.toDate?ride.completedAt.toDate():new Date(ride.completedAt);date.textContent='Completed: '+completed.toLocaleString();card.append(date);}card.append(title,label);
let comment=null;
if(role==='rider'){const commentLabel=document.createElement('label');commentLabel.textContent='Comment about your driver (optional)';commentLabel.style.display='block';comment=document.createElement('textarea');comment.maxLength=1000;comment.rows=3;comment.value=ride.driverComment||'';comment.style.cssText='display:block;width:100%;padding:10px;margin-top:8px';comment.setAttribute('aria-label','Comment about your driver');commentLabel.append(comment);const notice=document.createElement('p');notice.textContent='Your driver can see this comment and rating.';card.append(commentLabel,notice);}
else {const feedback=document.createElement('div');feedback.dataset.fitLongText='true';feedback.style.cssText='margin:12px 0;padding:14px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere';feedback.textContent='Feedback from this rider\nYour rating: '+(ride.driverRating?ride.driverRating+' / 5':'Not rated yet')+'\nTip received: '+money(Number(ride.tipAmount)||0)+'\nRider comment: '+(ride.driverComment||'No comment yet');card.append(feedback);}
let percent=null,custom=null,preview=null;
if(role==='rider'&&!ride.tipSubmitted&&!(Number(ride.tipAmount)>0)&&ride.fare!=null&&ride.pricingStatus!=='quote_required'){const tipLabel=document.createElement('label');tipLabel.style.marginLeft='16px';tipLabel.textContent='Tip ';percent=document.createElement('select');percent.innerHTML='<option value="0">No tip</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="custom">Custom %</option>';const stored=Number(ride.tipPercent)||0;percent.value=[0,10,15,20].includes(stored)?String(stored):'custom';custom=document.createElement('input');custom.type='number';custom.min='0';custom.max='100';custom.step='0.1';custom.value=stored;custom.setAttribute('aria-label','Custom tip percentage');custom.style.width='90px';preview=document.createElement('p');function update(){custom.hidden=percent.value!=='custom';const p=percent.value==='custom'?Number(custom.value):Number(percent.value);const tip=Math.round(Number(ride.fare)*p)/100;preview.textContent='Tip: '+money(tip)+' | Rider total: '+money(Number(ride.fare)+tip)+' (recorded amount; no payment is charged here)';}percent.onchange=update;custom.oninput=update;update();tipLabel.append(percent,custom);const tipBox=document.createElement('div');const submitTip=document.createElement('button');submitTip.type='button';submitTip.textContent='Submit tip';const tipResult=document.createElement('p');tipResult.setAttribute('role','status');tipBox.append(tipLabel,preview,submitTip,tipResult);card.append(tipBox);
submitTip.onclick=async()=>{
 if(auth.currentUser?.uid!==user.uid||submitTip.disabled)return;
 if(percent.value==='custom'&&(custom.value===''||!custom.reportValidity()))return;
 const p=percent.value==='custom'?Number(custom.value):Number(percent.value);
 if(!Number.isFinite(p)||p<0||p>100){tipResult.textContent='Enter a percentage from 0 to 100.';return;}
 const tipAmount=Math.round(Number(ride.fare)*p)/100;
 submitTip.disabled=true;
 try{
  await updateDoc(doc(db,'rides',ride.id),{tipPercent:p,tipAmount,totalFare:Math.round((Number(ride.fare)+tipAmount)*100)/100,tipSubmitted:true});
  tipBox.hidden=true;
 }catch(e){tipResult.textContent='Tip was not saved. Please retry.';submitTip.disabled=false;}
};}
const save=document.createElement('button');save.type='button';save.textContent='Save review';save.style.margin='12px';const result=document.createElement('p');result.setAttribute('role','status');save.onclick=async()=>{if(auth.currentUser?.uid!==user.uid)return;if(!rating.value){result.textContent='Choose a rating from 1 to 5 stars.';return;}const values={[role==='rider'?'driverRating':'riderRating']:Number(rating.value)};if(comment) values.driverComment=comment.value.trim();save.disabled=true;try{await updateDoc(doc(db,'rides',ride.id),values);result.textContent='Saved.';}catch(e){result.textContent=e.code==='permission-denied'?'Unable to save: check Firebase review permissions.':'Unable to save. Please retry.';}finally{save.disabled=false;}};card.append(save,result);jobs.append(card);}};refreshHistory();},()=>{message.textContent='Unable to load reviews. Check account approval and ride permissions.';});}catch{message.textContent='Unable to load your account.';}});
