import {isDriverOnline, observeDriverOnline} from './driver-availability.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {towJobWindow, filterTowJobs} from './tow-job-filter.js';
import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged,addDoc,serverTimestamp} from './firebase-session.js';
import {runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {driverDetails} from './ride-details.js';
import {offerAmount,checkTowOpen,checkOfferVersion,offerResponse,acceptedTowFields} from './tow-offer-state.js?v=20261025-two-sided-accept';
const driver=location.pathname.endsWith('/driver.html'),role=driver?'driver':'rider';
const queue=document.getElementById('jobServiceFilter') || document.getElementById('providerService');
const panel=document.createElement('section');panel.className='tow-offers';document.querySelector('main').prepend(panel);
const heading=document.createElement('h2');heading.textContent=driver?'Tow offers & rider issues':'Tow driver offers & live messages';
const note=document.createElement('p');note.textContent=driver?'Send your towing price or accept the rider’s counteroffer. After acceptance, use Driver Job Controls to start and complete the job.':'Compare driver offers. Accept a price, send a counteroffer, or decline. Accepting assigns that tow driver. Messages appear live after sending.';
const status=document.createElement('p');status.setAttribute('role','status');const cards=document.createElement('div');cards.className='tow-conversations';cards.tabIndex=0;cards.setAttribute('role','region');cards.setAttribute('aria-label','Towing offers and conversations; scroll up or down');const content=document.createElement('div');content.append(heading,note,status,cards);panel.append(content);panel.hidden=true;
if(driver){const links=document.getElementById('driverPageLinks');if(links){links.classList.add('driver-page-links');panel.prepend(links);}}
let uid=null,epoch=0,application=null,pending=new Map(),assigned=new Map(),stops=[],busy=false;
const chatPositions=new Map();
const offers=new Map(),offerStops=new Map(),chats=new Map(),chatStops=new Map(),drafts=new Map();
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const filterControls=document.createElement('div');filterControls.className='tow-job-filters';
const filterDays=document.createElement('input'),filterStart=document.createElement('input'),filterEnd=document.createElement('input'),filterLimit=document.createElement('select'),filterJob=document.createElement('select');
const filterSummary=document.createElement('p');filterSummary.setAttribute('role','status');let pickerSignature='';
if(driver){
 const window=towJobWindow();
 for(const [label,input,type,value] of [['Past days (1–30)',filterDays,'number','1'],['Start date',filterStart,'date',window.start],['End date',filterEnd,'date',window.end],['Newest jobs',filterLimit,'select',null],['Choose a job',filterJob,'select',null]]){
  const wrap=document.createElement('label');wrap.textContent=label;input.setAttribute('aria-label',label);
  if(type!=='select'){input.type=type;input.value=value;}
  if(type==='date'){input.required=true;input.min=window.earliest;input.max=window.end;}
  wrap.append(input);filterControls.append(wrap);
 }
 filterDays.min='1';filterDays.max='30';filterDays.step='1';
 for(const count of [1,2,3]){const option=document.createElement('option');option.value=String(count);option.textContent=String(count)+(count===1?' job':' jobs');filterLimit.append(option);}
 const today=document.createElement('button');today.type='button';today.textContent='Today';filterControls.append(today);
 content.insertBefore(filterControls,status);content.insertBefore(filterSummary,status);
 const change=()=>{cards.scrollTop=0;filterJob.value='';reconcile();};
 filterDays.onchange=()=>{const range=towJobWindow(filterDays.valueAsNumber);if(!range){filterDays.setCustomValidity('Enter a whole number from 1 to 30.');filterDays.reportValidity();return;}filterDays.setCustomValidity('');filterStart.value=range.start;filterEnd.value=range.end;change();};
 filterStart.onchange=filterEnd.onchange=()=>{filterDays.value='';filterDays.setCustomValidity('');change();};
 filterLimit.onchange=change;filterJob.onchange=()=>{cards.scrollTop=0;reconcile();};
 today.onclick=()=>{const range=towJobWindow();filterDays.value='1';filterDays.setCustomValidity('');filterStart.value=filterEnd.value=range.end;change();};
}
function selectedTowJobs(){
 return driver?filterTowJobs(jobs(),{start:filterStart.value,end:filterEnd.value,limit:Number(filterLimit.value),jobId:filterJob.value}).jobs:jobs();
}
function refreshTowPicker(){
 if(!driver)return;
 const selection=filterJob.value,result=filterTowJobs(jobs(),{start:filterStart.value,end:filterEnd.value,limit:Number(filterLimit.value)});
 const signature=JSON.stringify(result.available.map(job=>[job.id,job.requestedAt,job.pickup,job.dropoff]));
 if(signature!==pickerSignature||!filterJob.options.length){
  pickerSignature=signature;filterJob.replaceChildren();
  const latest=document.createElement('option');latest.value='';latest.textContent='Newest selected jobs';filterJob.append(latest);
  for(const job of result.available){const option=document.createElement('option');option.value=job.id;const date=job.requestedAt?.toDate?job.requestedAt.toDate():new Date(job.requestedAt);option.textContent=date.toLocaleDateString()+' | '+(job.pickup||'Pickup')+' → '+(job.dropoff||'Destination')+' | '+job.id.slice(-8);filterJob.append(option);}
 }
 filterJob.value=result.available.some(job=>job.id===selection)?selection:'';
 filterSummary.textContent=result.error || 'Showing '+selectedTowJobs().length+' of '+result.available.length+' active tow requests in these dates. Newest first, by rider request date.';
}

function ref(rideId,driverId){return doc(db,'rides',rideId,'towOffers',driverId);}
function jobs(){return [...new Map([...pending,...assigned]).values()].filter(ride=>(!driver||isDriverOnline()||ride.driverId===uid)&&ride.serviceType==='tow'&&['requested','accepted','started','arrived'].includes(ride.status));}
function fail(error){status.textContent=error.code==='permission-denied'?'Towing offers or messages were blocked. The updated Firebase rules must be published.':error.message||'Unable to save. Please retry.';}
async function action(work){if(busy)return;busy=true;render();try{const result=await work();if(result!==false)status.textContent='Saved. Updates appear live.';}catch(error){fail(error);}finally{busy=false;render();}}
function add(parent,tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;parent.append(el);return el;}
function field(parent,key,label,value,textarea=false){
 const wrap=add(parent,'label',label),input=add(wrap,textarea?'textarea':'input');
 if(textarea){input.rows=3;input.maxLength=2000;}else{input.type='number';input.min='0.01';input.max='100000';input.step='0.01';input.inputMode='decimal';}
 input.value=drafts.has(key)?drafts.get(key):(value??'');input.dataset.towDraft=key;input.setAttribute('aria-label',label);input.oninput=()=>drafts.set(key,input.value);input.disabled=busy;return input;
}
function button(parent,label,work){const b=add(parent,'button',label);b.type='button';b.disabled=busy;b.onclick=()=>action(work);return b;}
async function propose(ride,cached,amount){
 if(!isDriverOnline())throw new Error('Go online before sending a towing offer.');
 const value=offerAmount(amount),actor=uid;if(!actor||auth.currentUser?.uid!==actor)throw new Error('Sign in again.');
 const driverFields=driverDetails(application,actor);
 await runTransaction(db,async tx=>{
  const rideRef=doc(db,'rides',ride.id),offerRef=ref(ride.id,actor);
  const current=await tx.get(rideRef),previous=await tx.get(offerRef);
  if(!current.exists())throw new Error('Tow request no longer exists.');checkTowOpen(current.data());checkOfferVersion(previous.exists()?previous.data():null,cached);
  if(auth.currentUser?.uid!==actor)throw new Error('Account changed.');
  if(!isDriverOnline())throw new Error('Go online before sending a towing offer.');
  tx.set(offerRef,{...driverFields,
   amount:value,counterAmount:null,status:'pending',revision:(previous.data()?.revision||0)+1,updatedAt:serverTimestamp()});
 });
 drafts.delete(ride.id+':'+actor+':price');
}
async function respond(ride,cached,choice,value){
 const actor=uid;if(!actor||auth.currentUser?.uid!==actor)throw new Error('Sign in again.');
 if(driver&&(!isDriverOnline()||cached?.driverId!==actor))throw new Error('Go online with the driver account for this offer.');
 offerResponse(cached,choice,value,role);
 if(choice==='accept'){
  const preview=acceptedTowFields(ride,cached,new Date().toISOString(),role);
  const question=driver?'Accept the rider’s '+money(preview.fare)+' counteroffer and take this towing job?':'Accept '+money(preview.fare)+' from '+cached.driverName+'? Total with your saved tip: '+money(preview.totalFare)+'. This assigns the tow driver.';
  if(!confirm(question))return false;
 }
 await runTransaction(db,async tx=>{
  const rideRef=doc(db,'rides',ride.id),offerRef=ref(ride.id,cached.driverId);
  const current=await tx.get(rideRef),offer=await tx.get(offerRef);
  if(!current.exists()||!offer.exists()||(driver?offer.data().driverId!==actor:current.data().riderId!==actor))throw new Error('Offer is unavailable.');checkTowOpen(current.data());checkOfferVersion(offer.data(),cached);
  if(choice==='accept' && current.data().tipPercent!==ride.tipPercent)throw new Error('Your tip changed. Review the latest total and try again.');
  const next=offerResponse(offer.data(),choice,value,role);
  if(auth.currentUser?.uid!==actor)throw new Error('Account changed.');
  if(driver&&!isDriverOnline())throw new Error('Go online before accepting a towing counteroffer.');
  if(choice==='accept')tx.update(rideRef,acceptedTowFields(current.data(),offer.data(),new Date().toISOString(),role));
  tx.update(offerRef,{...next,updatedAt:serverTimestamp()});
 });
 drafts.delete(ride.id+':'+cached.driverId+':counter');
}
function chat(parent,ride,offer){
 const key=ride.id+':'+offer.driverId;
 const log=add(parent,'div',null,'tow-offer-chat');log.dataset.towChat=key;log.setAttribute('aria-label','Messages with '+(driver?'rider':offer.driverName));
 const messages=chats.get(key)||[];
 if(!messages.length)add(log,'p','No messages yet.');
 for(const m of messages){
  const isDriver=m.senderRole==='driver',label=isDriver?'Driver':'Rider';
  const name=String((isDriver?offer.driverName:ride.riderName)||'').trim().split(/\s+/)[0];
  add(log,'p',label+(name&&name.toLowerCase()!==label.toLowerCase()?' '+name:'')+': '+m.text,isDriver?'tow-message-driver':'tow-message-rider');
 }
 const position=chatPositions.get(key);log.scrollTop=!position||position.atBottom?log.scrollHeight:position.top;
 if(offer.status==='declined')return;
 const input=field(parent,key+':message',driver?'Message the rider':'Describe the issue or message the driver','',true);
 button(parent,'Send message',async()=>{
  const text=input.value.trim();if(!text)throw new Error('Enter a message.');if(text.length>2000)throw new Error('Keep messages under 2,000 characters.');
  if(auth.currentUser?.uid!==uid)throw new Error('Sign in again.');
  await addDoc(collection(db,'rides',ride.id,'towOffers',offer.driverId,'messages'),{senderId:uid,senderRole:role,text,createdAt:serverTimestamp()});drafts.delete(key+':message');
 });
}
function render(){
 const scrollTop=cards.scrollTop;
 chatPositions.clear();for(const log of cards.querySelectorAll('[data-tow-chat]'))chatPositions.set(log.dataset.towChat,{top:log.scrollTop,atBottom:log.scrollHeight-log.clientHeight-log.scrollTop<30});
 const focus=document.activeElement,key=focus?.dataset?.towDraft,start=focus?.selectionStart,end=focus?.selectionEnd;
 cards.replaceChildren();refreshTowPicker();const all=selectedTowJobs(),active=jobs();cards.dataset.empty=String(!all.length);content.hidden=!uid||!active.length||(driver&&queue&&!['all','tow'].includes(queue.value)&&!active.some(ride=>ride.driverId===uid));panel.hidden=driver?!uid:content.hidden;
 if(!all.length){add(cards,'p',driver?'No tow requests match these dates. Choose a wider range up to 30 days.':'No active tow requests.');return;}
 for(const ride of all){
  const card=add(cards,'div',null,'tow-offer-card');add(card,'h3',ride.pickup+' → '+ride.dropoff);add(card,'p','Job: '+ride.id);
  add(card,'p','Vehicle: '+(ride.serviceDetails?.vehicle||'Not specified'));add(card,'p','Rider’s issue: '+(ride.serviceDetails?.issue||'Not specified'),'tow-offer-issue');
  const items=(offers.get(ride.id)||[]).filter(o=>ride.status==='requested'||o.driverId===ride.driverId);
  if(driver&&ride.status==='requested'){
   const own=items[0],price=field(card,ride.id+':'+uid+':price','Your towing price ($), before rider tip',own?.amount??ride.fare??'');
   if(own)add(card,'p','Your offer: '+money(own.amount)+' — '+own.status,'tow-offer-status');
   if(own?.status==='countered'){
    add(card,'p','Rider’s counteroffer: '+money(own.counterAmount));
   }
   const accept=button(card,'Accept offer',()=>respond(ride,own,'accept'));accept.disabled=busy||own?.status!=='countered';if(own?.status!=='countered')accept.title='Send your price first; you can accept a rider counteroffer.';
   button(card,own?'Send revised offer':'Send offer',()=>propose(ride,own,price.value));
   if(own)chat(card,ride,own);
  }else{
   if(!items.length)add(card,'p','Waiting for tow driver offers.');
   for(const offer of items){
    const item=add(card,'div',null,'tow-offer-card');add(item,'h3',offer.driverName+' — '+money(offer.amount));add(item,'p','Offer: '+offer.status,'tow-offer-status');
    if(offer.status==='countered')add(item,'p','Your counteroffer: '+money(offer.counterAmount)+' — waiting for driver acceptance or a revised offer.');
    if(!driver&&ride.status==='requested'&&['pending','countered'].includes(offer.status)){
     const actions=add(item,'div',null,'tow-offer-actions');
     const accept=button(actions,'Accept offer',()=>respond(ride,offer,'accept'));accept.disabled=busy||offer.status!=='pending';if(offer.status!=='pending')accept.title='Waiting for the driver to accept your counteroffer or send a revised offer.';
     const counter=field(actions,ride.id+':'+offer.driverId+':counter','Your counter price ($)',offer.counterAmount??offer.amount);
     button(actions,'Send counteroffer',()=>respond(ride,offer,'counter',counter.value));button(actions,'Decline offer',()=>respond(ride,offer,'decline'));
    }
    if(driver&&['accepted','started','arrived'].includes(ride.status)){const controls=add(item,'a','Use Driver Job Controls to '+(ride.status==='accepted'?'Start Ride':ride.status==='started'?'Arrive at Pickup':'Complete Ride'));controls.href='#driverControls';}
    chat(item,ride,offer);
   }
  }
 }
 cards.scrollTop=scrollTop;
 if(key){const input=[...cards.querySelectorAll('[data-tow-draft]')].find(el=>el.dataset.towDraft===key);if(input&&!input.disabled){input.focus({preventScroll:true});if(input.tagName==='TEXTAREA'&&start!=null)input.setSelectionRange(start,end);}}
}
function reconcile(){
 refreshTowPicker();
 const active=selectedTowJobs(),ids=new Set(active.map(r=>r.id)),expected=epoch;
 for(const [id,stop] of offerStops)if(!ids.has(id)){stop();offerStops.delete(id);offers.delete(id);}
 for(const ride of active)if(!offerStops.has(ride.id)){
  const target=driver?ref(ride.id,uid):collection(db,'rides',ride.id,'towOffers');
  offerStops.set(ride.id,liveSnapshot(target,snapshot=>{
   if(epoch!==expected)return;
   offers.set(ride.id,driver?(snapshot.exists()?[snapshot.data()]:[]):snapshot.docs.map(d=>d.data()));
   syncChats();render();
  },fail));
 }
 syncChats();render();
}
function syncChats(){
 const expected=epoch,needed=new Map();
 for(const ride of selectedTowJobs())for(const offer of offers.get(ride.id)||[]){if(ride.status!=='requested'&&offer.driverId!==ride.driverId)continue;needed.set(ride.id+':'+offer.driverId,[ride.id,offer.driverId]);}
 for(const [key,stop] of chatStops)if(!needed.has(key)){stop();chatStops.delete(key);chats.delete(key);}
 for(const [key,[rideId,driverId]] of needed)if(!chatStops.has(key))chatStops.set(key,liveSnapshot(collection(db,'rides',rideId,'towOffers',driverId,'messages'),snapshot=>{
  if(epoch!==expected)return;chats.set(key,snapshot.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0)||a.id.localeCompare(b.id)));render();
 },fail));
}
onAuthStateChanged(auth,async user=>{
 const current=++epoch;stops.splice(0).forEach(stop=>stop());offerStops.forEach(stop=>stop());chatStops.forEach(stop=>stop());offerStops.clear();chatStops.clear();offers.clear();chats.clear();drafts.clear();pending.clear();assigned.clear();uid=null;application=null;status.textContent='';render();if(!user)return;
 try{
  const profile=await getDoc(doc(db,'users',user.uid));if(current!==epoch||profile.data()?.role!==role||!['approved','active'].includes(profile.data()?.accountStatus))return;
  if(driver){const app=await getDoc(doc(db,'driverApplications','driver_'+user.uid));if(current!==epoch||app.data()?.status!=='approved')return;application=app.data();}
  uid=user.uid;
  const watch=(q,target)=>stops.push(liveSnapshot(q,snapshot=>{if(current!==epoch)return;target.clear();for(const d of snapshot.docs)target.set(d.id,{...d.data(),id:d.id});reconcile();},fail));
  if(driver){
   let stopPending,revision=0;
   stops.push(observeDriverOnline(online=>{
    const requestRevision=++revision;stopPending?.();stopPending=null;pending.clear();reconcile();
    if(online)stopPending=liveSnapshot(query(collection(db,'rides'),where('status','==','requested')),snapshot=>{
     if(current!==epoch||requestRevision!==revision||!isDriverOnline())return;
     pending.clear();for(const d of snapshot.docs)pending.set(d.id,{...d.data(),id:d.id});reconcile();
    },fail);
   }));
   stops.push(()=>{revision++;stopPending?.();});
   watch(query(collection(db,'rides'),where('driverId','==',uid)),assigned);
  }
  else watch(query(collection(db,'rides'),where('riderId','==',uid)),pending);
 }catch(error){fail(error);}
});

queue?.addEventListener('change',render);

