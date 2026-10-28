import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged} from '../firebase-session.js';
import {receiptFolders} from './receipt-data.js';
const status=document.getElementById('status'), folders=document.getElementById('folders');
const money=value=>value===null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
let stop=null,generation=0;
function receiptContent(receipt){
 const article=document.createElement('article'), title=document.createElement('h2');title.textContent='FareRide Ride Receipt';article.append(title);
 const fields=[['Receipt / Ride ID',receipt.id],['Completed',receipt.date?new Date(receipt.date).toLocaleString():'Not recorded'],
 ['Driver',receipt.driver],['Rider',receipt.rider],['Service',receipt.service],['Pickup',receipt.pickup],['Destination',receipt.dropoff],
 ['Distance',receipt.miles===null?'Not recorded':receipt.miles+' miles'],['Fare',money(receipt.fare)],['Tip',money(receipt.tip)],['Total ride charge',money(receipt.total)]];
 const dl=document.createElement('dl');
 for(const [key,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}
 const note=document.createElement('p');note.textContent='Generated from the completed ride record. Payment collection and payment method are not verified by this receipt.';note.className='note';article.append(dl,note);return article;
}
function render(rides,uid){
 const receipts=receiptFolders(rides,uid);folders.replaceChildren();status.textContent=receipts.length?receipts.length+' receipt folders':'No completed rides yet. Your receipts will appear here after each ride.';
 for(const receipt of receipts){
  const folder=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Receipt folder — '+(receipt.date?new Date(receipt.date).toLocaleDateString():'Date not recorded')+' — '+receipt.id;folder.append(summary,receiptContent(receipt));
  const actions=document.createElement('div');actions.className='actions';
  const download=document.createElement('button');download.type='button';download.textContent='Download receipt';
  download.onclick=()=>{
   const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FareRide Receipt</title><style>body{max-width:800px;margin:32px auto;padding:24px;font:16px/1.6 Arial}dt{font-weight:bold}dd{margin:0 0 12px;overflow-wrap:anywhere}</style></head><body>'+receiptContent(receipt).outerHTML+'</body></html>';
   const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download='FareRide-Receipt-'+receipt.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const print=document.createElement('button');print.type='button';print.textContent='Print / Save PDF';print.onclick=()=>{folder.open=true;folder.classList.add('printing');try{window.print();}finally{folder.classList.remove('printing');}};
  actions.append(download,print);folder.append(actions);folders.append(folder);
 }
}
onAuthStateChanged(auth,async user=>{
 const current=++generation;stop?.();stop=null;folders.replaceChildren();
 status.textContent='Sign in using Driver Login to view your receipts.';if(!user)return;
 status.textContent='Checking your driver account…';
 try{
  const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;
  if(!profile.exists()||profile.data().role!=='driver'){status.textContent='Sign in with a Driver account to view receipts.';return;}
  status.textContent='Loading receipt folders…';
  stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',user.uid)),snapshot=>{
   if(current!==generation||auth.currentUser?.uid!==user.uid)return;
   render(snapshot.docs.map(item=>({...item.data(),id:item.id})),user.uid);
  },()=>{if(current!==generation)return;folders.replaceChildren();status.textContent='Unable to load receipts. Check your connection and driver account access.';});
 }catch{if(current===generation)status.textContent='Unable to verify your driver account. Please sign in again.';}
});
