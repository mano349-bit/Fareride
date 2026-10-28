import {auth,db,doc,getDoc,collection,query,where,onSnapshot,onAuthStateChanged} from './firebase-session.js';
import {amounts} from './admin-financials.js';
import {tollAmount,riderTotal} from './toll-accounting.js';
const role=location.pathname.toLowerCase().includes('driver')?'driver':'rider';
const section=document.createElement('section');section.className='card';section.hidden=true;document.querySelector('main').append(section);
const money=n=>n===null?'Unpriced':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let stop=null,version=0;
onAuthStateChanged(auth,async user=>{
 const current=++version;stop?.();section.replaceChildren();section.hidden=true;if(!user)return;
 try{const profile=await getDoc(doc(db,'users',user.uid));if(current!==version||!profile.exists()||profile.data().role!==role)return;
 stop=onSnapshot(query(collection(db,'rides'),where(role+'Id','==',user.uid)),snapshot=>{
  if(current!==version)return;section.replaceChildren();
  const rides=snapshot.docs.map(d=>({...d.data(),id:d.id})).filter(r=>['accepted','started','arrived','completed'].includes(r.status)).sort((a,b)=>String(b.completedAt||b.acceptedAt||'').localeCompare(String(a.completedAt||a.acceptedAt||''))).slice(0,20);
  section.hidden=!rides.length;if(!rides.length)return;const title=document.createElement('h2');title.textContent='Ride totals including tolls';section.append(title);
  for(const ride of rides){const line=document.createElement('p');line.textContent='Ride '+ride.id+' | '+ride.status+' | Toll: '+money(tollAmount(ride))+' | Rider total: '+money(riderTotal(ride))+(role==='driver'?' | Your earnings including full toll reimbursement: '+money(amounts(ride)?.driver??null):'');section.append(line);}
 },()=>{if(current!==version)return;section.replaceChildren();section.hidden=false;section.textContent='Unable to load ride totals.';});
 }catch{if(current===version){section.replaceChildren();section.hidden=true;}}
});
