import {receiptTollItems} from './receipt-toll-items.js';
import {periodForDays,periodDayCount} from '../earnings-period.js';
import {localDay} from '../rider-history-dates.js';
import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged} from '../firebase-session.js';
import {receiptFolders,receiptFields,receiptNote} from './receipt-data.js?v=20261028-itemized-tolls';
import {receiptPDF} from './receipt-pdf.js?v=20261028-onepage';
const role=document.body.dataset.receiptRole || 'driver';
const roleLabel=role==='rider'?'Rider':'Driver';
let pdfURLs=[],stopTollDetails=[],tollView=0;
function clearTollDetails(){tollView++;for(const stop of stopTollDetails)stop();stopTollDetails=[];}
function clearPDFs(){for(const url of pdfURLs)URL.revokeObjectURL(url);pdfURLs=[];}
const status=document.getElementById('status'), folders=document.getElementById('folders');
let stop=null,generation=0;
let loadedRides=[],loadedUid=null;
const filters=document.createElement('div');filters.className='receipt-period';
filters.innerHTML='<label>Start date <input id="receiptStart" type="date" required></label><label>End date <input id="receiptEnd" type="date" required></label><label>Days (1–365) <input id="receiptDays" type="number" min="1" max="365" step="1" value="365" required></label><button id="receiptApplyDays" type="button">Apply days</button>';
filters.style.cssText='display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:16px 0';
folders.before(filters);
const periodStart=filters.querySelector('#receiptStart'),periodEnd=filters.querySelector('#receiptEnd'),periodDays=filters.querySelector('#receiptDays');
const initial=periodForDays(localDay(),365);periodStart.value=initial.start;periodEnd.value=initial.end;
const refreshPeriod=()=>{if(loadedUid)render(loadedRides,loadedUid);};
periodStart.onchange=periodEnd.onchange=refreshPeriod;
filters.querySelector('#receiptApplyDays').onclick=()=>{if(!periodDays.reportValidity())return;const range=periodForDays(periodEnd.value||localDay(),Number(periodDays.value));if(!range)return;periodStart.value=range.start;periodEnd.value=range.end;refreshPeriod();};

function receiptContent(receipt){
 const article=document.createElement('article'), title=document.createElement('h2');title.textContent='FareRide Ride Receipt';article.append(title);
 const fields=receiptFields(receipt);
 const dl=document.createElement('dl');
 for(const [key,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}
 const note=document.createElement('p');note.textContent=receiptNote;note.className='note';article.append(dl,note);return article;
}
function render(rides,uid){
 loadedRides=rides;loadedUid=uid;
 const days=periodDayCount(periodStart.value,periodEnd.value);clearTollDetails();clearPDFs();folders.replaceChildren();
 if(days===null){status.textContent='Choose a valid date range from 1 to 365 days.';return;}
 periodDays.value=days;
 const receipts=receiptFolders(rides,uid,role).filter(receipt=>{if(!receipt.date)return false;const day=localDay(new Date(receipt.date));return day>=periodStart.value&&day<=periodEnd.value;});
 const tollCents=receipts.reduce((sum,receipt)=>sum+Math.round((receipt.tolls||0)*100),0);
 const totalCents=receipts.reduce((sum,receipt)=>sum+Math.round((receipt.total||0)*100),0);
 const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
 status.textContent=receipts.length+' receipts | '+days+' days | Total tolls: '+money(tollCents/100)+' | '+(role==='driver'?'Tolls reimbursed 100% to you':'Total ride fees: '+money(totalCents/100));

 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px';
 const caption=document.createElement('caption');caption.textContent='Receipt charges — tolls go 100% to the driver';table.append(caption);
 const head=document.createElement('thead'),header=document.createElement('tr');
 for(const label of ['Ride','Date','Fare','Tip','Toll','Total fee']){const th=document.createElement('th');th.scope='col';th.textContent=label;th.style.cssText='padding:8px;border:1px solid #0754b6;background:#fff4a3';header.append(th);}head.append(header);table.append(head);
 const body=document.createElement('tbody');table.append(body);
 const wrap=document.createElement('div');wrap.className='receipt-charges';wrap.style.overflowX='auto';wrap.append(table);folders.append(wrap);
 const cash=value=>value===null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
 for(const receipt of receipts){const row=document.createElement('tr');for(const value of [receipt.id,receipt.date?new Date(receipt.date).toLocaleDateString():'Not recorded',cash(receipt.fare),cash(receipt.tip),cash(receipt.tolls),cash(receipt.total)]){const cell=document.createElement('td');cell.textContent=value;cell.style.cssText='padding:8px;border:1px solid #0754b6;overflow-wrap:anywhere';row.append(cell);}body.append(row);}
 const foot=document.createElement('tfoot'),totals=document.createElement('tr');
 const label=document.createElement('th');label.scope='row';label.colSpan=4;label.textContent='Period totals';totals.append(label);
 const tollCell=document.createElement('td');tollCell.textContent=money(tollCents/100);const totalCell=document.createElement('td');totalCell.textContent=money(totalCents/100)+(receipts.some(receipt=>receipt.total===null)?' (known amounts)':'');
 totals.append(tollCell,totalCell);foot.append(totals);table.append(foot);
 for(const receipt of receipts){
  const folder=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Receipt folder — '+(receipt.date?new Date(receipt.date).toLocaleDateString():'Date not recorded')+' — '+receipt.id;folder.append(summary,receiptContent(receipt));
  const actions=document.createElement('div');actions.className='actions';
  const download=document.createElement('button');download.type='button';download.textContent='Download PDF';
  let currentPDF=null;
  const updateReceipt=()=>{
   print.disabled=false;
   const article=folder.querySelector('article');if(article)article.replaceWith(receiptContent(receipt));
   if(currentPDF)URL.revokeObjectURL(currentPDF);
   try{const blob=receiptPDF(receiptFields(receipt),receiptNote);currentPDF=URL.createObjectURL(blob);pdfURLs.push(currentPDF);
    download.disabled=false;download.textContent='Download PDF';
    download.onclick=()=>{const link=document.createElement('a');link.href=currentPDF;link.download='FareRide-Receipt-'+receipt.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';document.body.append(link);link.click();link.remove();};
   }catch{download.disabled=true;download.textContent='PDF unavailable — use Print / Save PDF';}
  };
  download.disabled=true;download.textContent='Loading toll details…';
  const version=tollView,expectedUid=uid;
  const stop=onSnapshot(collection(db,'rides',receipt.id,'tollEvents'),snapshot=>{
   if(version!==tollView||auth.currentUser?.uid!==expectedUid)return;
   receipt.tollItems=receiptTollItems(snapshot.docs.map(item=>({...item.data(),id:item.id})));receipt.tollDetailsLoaded=true;receipt.tollDetailsError=false;updateReceipt();
  },()=>{
   if(version!==tollView||auth.currentUser?.uid!==expectedUid)return;
   receipt.tollItems=[];receipt.tollDetailsLoaded=true;receipt.tollDetailsError=true;updateReceipt();
  });stopTollDetails.push(stop);
  const print=document.createElement('button');print.type='button';print.disabled=true;print.textContent='Print / Save PDF';print.onclick=()=>{folder.open=true;folder.classList.add('printing');try{window.print();}finally{folder.classList.remove('printing');}};
  actions.append(download,print);folder.append(actions);folders.append(folder);
 }
}
onAuthStateChanged(auth,async user=>{
 const current=++generation;stop?.();stop=null;loadedRides=[];loadedUid=null;clearPDFs();folders.replaceChildren();
 status.textContent='Sign in using '+roleLabel+' Login to view your receipts.';if(!user)return;
 status.textContent='Checking your '+role+' account…';
 try{
  const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;
  if(!profile.exists()||profile.data().role!==role){status.textContent='Sign in with a '+roleLabel+' account to view receipts.';return;}
  status.textContent='Loading receipt folders…';
  stop=onSnapshot(query(collection(db,'rides'),where(role+'Id','==',user.uid)),snapshot=>{
   if(current!==generation||auth.currentUser?.uid!==user.uid)return;
   render(snapshot.docs.map(item=>({...item.data(),id:item.id})),user.uid);
  },()=>{if(current!==generation)return;clearPDFs();folders.replaceChildren();status.textContent='Unable to load receipts. Check your connection and account access.';});
 }catch{if(current===generation)status.textContent='Unable to verify your '+role+' account. Please sign in again.';}
});

