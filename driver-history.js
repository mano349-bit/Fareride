import { auth, db, doc, getDoc, collection, query, where, onSnapshot, onAuthStateChanged } from './firebase-config.js';
import { driverReport } from './driver-report.js';
const panel = document.createElement('section'); panel.className='card';
panel.innerHTML='<h2>My completed jobs and earnings</h2><label>Period <select id="earningsDays"><option value="1">Today</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365" selected>365 days</option></select></label><p id="earningsSummary" role="status">Sign in as a driver to load history.</p><p>Costs are entered per job and saved only in this browser, under your account. Include fuel, tolls and other job expenses. Net profit is provisional until all costs are recorded. Earnings use recorded payouts or an estimate of 75% of fare plus tips. Totals are not payment confirmations.</p><div id="earningsJobs"></div>';
document.querySelector('main').append(panel);
const selector=panel.querySelector('#earningsDays'), summary=panel.querySelector('#earningsSummary'), list=panel.querySelector('#earningsJobs');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let uid=null, rides=[], costs={}, stop=null, generation=0;
function render(){
 if(!uid)return;
 const report=driverReport(rides,uid,costs,Number(selector.value));
 summary.textContent=report.jobs.length+' completed jobs | Earnings: '+money(report.income)+' | Recorded costs: '+money(report.expenses)+' | '+(report.missing||report.unpriced?'Provisional net: ':'Net: ')+money(report.net)+(report.missing?' | Costs missing for '+report.missing+' jobs':'')+(report.unpriced?' | Unpriced jobs excluded: '+report.unpriced:'');
 list.replaceChildren();let day='';
 for(const job of report.jobs){
  const key=job.date.toLocaleDateString();
  if(key!==day){day=key;const header=document.createElement('h3');const rows=report.jobs.filter(r=>r.date.toLocaleDateString()===key);const income=rows.reduce((s,r)=>s+(r.earnings?.driver||0),0);const expense=rows.reduce((s,r)=>s+(r.cost||0),0);header.textContent=day+' | Earnings '+money(income)+' | Recorded costs '+money(expense)+' | '+(rows.some(r=>r.cost===null||!r.earnings)?'Provisional net ':'Net ')+money(income-expense);list.append(header);}
  const card=document.createElement('div');card.className='card';
  const detail=document.createElement('p');detail.textContent=job.date.toLocaleTimeString()+' | '+job.pickup+' to '+job.dropoff+' | Fare: '+(job.fare!=null?money(Number(job.fare)):'Unpriced')+' | Earnings: '+(job.earnings?money(job.earnings.driver)+(job.earnings.estimated?' (estimate)':''):'Unpriced')+' | Net: '+(job.cost!==null&&job.earnings?money(job.earnings.driver-job.cost):'Enter costs');
  const label=document.createElement('label');label.textContent='Job costs ($) ';
  const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.placeholder='Not recorded';input.value=job.cost??'';input.setAttribute('aria-label','Costs for job '+job.id);
  input.addEventListener('change',()=>{const amount=Number(input.value);if(input.value!==''&&(!Number.isFinite(amount)||amount<0)){input.setCustomValidity('Enter a nonnegative cost.');input.reportValidity();return;}input.setCustomValidity('');if(input.value==='')delete costs[job.id];else costs[job.id]=Math.round(amount*100)/100;try{localStorage.setItem('fareRide_driver_costs_'+uid,JSON.stringify(costs));render();}catch{summary.textContent='Unable to save costs in this browser. Enable browser storage and retry.';}});
  label.append(input);card.append(detail,label);list.append(card);
 }
 if(!report.jobs.length)list.textContent='No completed jobs in this period.';
}
selector.addEventListener('change',render);
onAuthStateChanged(auth,async user=>{const current=++generation;stop?.();stop=null;uid=null;rides=[];costs={};list.replaceChildren();summary.textContent='Sign in as a driver to load history.';if(!user)return;try{const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;uid=user.uid;try{const saved=JSON.parse(localStorage.getItem('fareRide_driver_costs_'+uid)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))costs=saved;}catch{}summary.textContent='Loading completed jobs...';stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',uid)),snapshot=>{if(current!==generation)return;rides=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{summary.textContent='Unable to load job history. Check driver approval and Firebase ride permissions.';list.replaceChildren();});}catch{summary.textContent='Unable to verify your driver account.';}});
