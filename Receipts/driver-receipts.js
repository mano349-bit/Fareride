import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged} from '../firebase-session.js';
import {receiptFolders,receiptFields,receiptNote} from './receipt-data.js?v=20261028-tolls';
import {receiptPDF} from './receipt-pdf.js?v=20261028-onepage';
const role=document.body.dataset.receiptRole || 'driver';
const roleLabel=role==='rider'?'Rider':'Driver';
let pdfURLs=[];
function clearPDFs(){for(const url of pdfURLs)URL.revokeObjectURL(url);pdfURLs=[];}
const status=document.getElementById('status'), folders=document.getElementById('folders');
let stop=null,generation=0;
function receiptContent(receipt){
 const article=document.createElement('article'), title=document.createElement('h2');title.textContent='FareRide Ride Receipt';article.append(title);
 const fields=receiptFields(receipt);
 const dl=document.createElement('dl');
 for(const [key,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}
 const note=document.createElement('p');note.textContent=receiptNote;note.className='note';article.append(dl,note);return article;
}
function render(rides,uid){
 const receipts=receiptFolders(rides,uid,role);clearPDFs();folders.replaceChildren();status.textContent=receipts.length?receipts.length+' receipt folders':'No completed rides yet. Your receipts will appear here after each ride.';
 const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px';
 const caption=document.createElement('caption');caption.textContent='Receipt charges — tolls go 100% to the driver';table.append(caption);
 const head=document.createElement('thead'),header=document.createElement('tr');
 for(const label of ['Ride','Date','Fare','Tip','Toll','Total fee']){const th=document.createElement('th');th.scope='col';th.textContent=label;th.style.cssText='padding:8px;border:1px solid #0754b6;background:#fff4a3';header.append(th);}head.append(header);table.append(head);
 const body=document.createElement('tbody');table.append(body);
 const wrap=document.createElement('div');wrap.className='receipt-charges';wrap.style.overflowX='auto';wrap.append(table);folders.append(wrap);
 const cash=value=>value===null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
 for(const receipt of receipts){const row=document.createElement('tr');for(const value of [receipt.id,receipt.date?new Date(receipt.date).toLocaleDateString():'Not recorded',cash(receipt.fare),cash(receipt.tip),cash(receipt.tolls),cash(receipt.total)]){const cell=document.createElement('td');cell.textContent=value;cell.style.cssText='padding:8px;border:1px solid #0754b6;overflow-wrap:anywhere';row.append(cell);}body.append(row);}
 for(const receipt of receipts){
  const folder=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Receipt folder — '+(receipt.date?new Date(receipt.date).toLocaleDateString():'Date not recorded')+' — '+receipt.id;folder.append(summary,receiptContent(receipt));
  const actions=document.createElement('div');actions.className='actions';
  const download=document.createElement('button');download.type='button';download.textContent='Download PDF';
  try{
   const blob=receiptPDF(receiptFields(receipt),receiptNote),url=URL.createObjectURL(blob);pdfURLs.push(url);
   download.onclick=()=>{const link=document.createElement('a');link.href=url;link.download='FareRide-Receipt-'+receipt.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';document.body.append(link);link.click();link.remove();};
  }catch{
   download.disabled=true;download.textContent='PDF unavailable — use Print / Save PDF';
  }
  const print=document.createElement('button');print.type='button';print.textContent='Print / Save PDF';print.onclick=()=>{folder.open=true;folder.classList.add('printing');try{window.print();}finally{folder.classList.remove('printing');}};
  actions.append(download,print);folder.append(actions);folders.append(folder);
 }
}
onAuthStateChanged(auth,async user=>{
 const current=++generation;stop?.();stop=null;clearPDFs();folders.replaceChildren();
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

