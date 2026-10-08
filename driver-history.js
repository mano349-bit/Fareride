import { auth, db, doc, getDoc, collection, query, where, onSnapshot, onAuthStateChanged } from './firebase-config.js';
import { driverReport } from './driver-report.js';
const panel = document.createElement('section'); panel.className='card';
panel.innerHTML='<h2>My completed jobs and earnings</h2><label>Period <input id="earningsDays" type="number" min="1" max="365" step="1" value="365" aria-label="Number of days, from 1 to 365"> days (1-365)</label><p id="earningsSummary" role="status">Sign in as a driver to load history.</p><p>Costs are entered per job and saved only in this browser, under your account. Include fuel, tolls and other job expenses. Net profit is provisional until all costs are recorded. Earnings use recorded payouts or an estimate of 75% of fare plus tips. Totals are not payment confirmations.</p><div id="earningsJobs"></div>';
panel.classList.add('driver-history');
const style = document.createElement('style');
style.textContent = '.driver-history{margin-top:24px}.driver-history #earningsDays{width:90px;padding:9px;border:1px solid #cbd5e1;border-radius:8px}.driver-history #earningsSummary{padding:16px;background:#eff6ff;border-radius:10px;font-weight:700;line-height:1.8}.earnings-table-wrap{overflow-x:auto;border:1px solid #dbe3ee;border-radius:12px}.earnings-table{width:100%;border-collapse:collapse;min-width:780px;font-size:14px}.earnings-table caption{text-align:left;padding:14px;font-weight:700}.earnings-table th{background:#eaf2ff;color:#173b68;text-align:left;white-space:nowrap}.earnings-table th,.earnings-table td{padding:13px 14px;border-bottom:1px solid #e5eaf1}.earnings-table tbody tr:nth-child(even){background:#f8fafc}.earnings-table .amount{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.earnings-table .daily-total,.earnings-table tfoot{background:#eef6ff;font-weight:700}.earnings-table input{width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:7px}.earnings-table .job-id{display:block;width:270px;max-width:100%;margin-top:8px;font-family:monospace;font-size:12px;background:#f8fafc;color:#173b68}.earnings-table small{display:block;color:#64748b;font-size:11px}';
document.head.append(style);
document.querySelector('main').append(panel);
const selector=panel.querySelector('#earningsDays'), summary=panel.querySelector('#earningsSummary'), list=panel.querySelector('#earningsJobs');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let uid=null, rides=[], costs={}, stop=null, generation=0;
function render(){
 if(!uid)return;
 if(!selector.checkValidity()){selector.reportValidity();return;}
 const report=driverReport(rides,uid,costs,Number(selector.value));
 summary.textContent=report.jobs.length+' completed jobs | Earnings: '+money(report.income)+' | Recorded costs: '+money(report.expenses)+' | '+(report.missing||report.unpriced?'Provisional net: ':'Net: ')+money(report.net)+(report.missing?' | Costs missing for '+report.missing+' jobs':'')+(report.unpriced?' | Unpriced jobs excluded: '+report.unpriced:'');
 list.replaceChildren();
 const wrap=document.createElement('div');wrap.className='earnings-table-wrap';
 const table=document.createElement('table');table.className='earnings-table';
 table.innerHTML='<caption>Completed jobs - past '+Number(selector.value)+' days</caption><thead><tr><th scope="col">Job #</th><th scope="col">Date / time</th><th scope="col">Job / route</th><th scope="col">Fare</th><th scope="col">Tip</th><th scope="col">Rider rating</th><th scope="col">Rider comment</th><th scope="col">My earnings</th><th scope="col">Costs ($)</th><th scope="col">Net profit</th></tr></thead>';
 const body=document.createElement('tbody');table.append(body);wrap.append(table);list.append(wrap);
 function cell(row,text,amount=false){const td=document.createElement('td');td.textContent=text;if(amount)td.className='amount';row.append(td);return td;}
 const days=[...new Set(report.jobs.map(job=>job.date.toLocaleDateString()))];
 for(const day of days){
 const rows=report.jobs.filter(job=>job.date.toLocaleDateString()===day);
 for(const job of rows){
  const card=document.createElement('tr');
  cell(card,String(job.jobNumber));
  cell(card,job.date.toLocaleDateString()+' '+job.date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  const route=cell(card,(job.pickup||'Pickup')+' to '+(job.dropoff||'Destination'));const id=document.createElement('input');id.type='text';id.readOnly=true;id.className='job-id';id.value=job.id;id.setAttribute('aria-label','Job ID for job '+job.jobNumber);id.addEventListener('click',()=>id.select());route.append(id);
  cell(card,job.fare!=null?money(Number(job.fare)):'Unpriced',true);
  cell(card,money(Number(job.tipAmount)||0),true);
  cell(card,job.driverRating ? job.driverRating+' / 5' : 'Not rated');
  const commentCell=cell(card,job.driverComment || 'No comment');commentCell.style.cssText='min-width:200px;max-width:300px;white-space:pre-wrap;overflow-wrap:anywhere';
  const earned=cell(card,job.earnings?money(job.earnings.driver):'Unpriced',true);if(job.earnings?.estimated){const note=document.createElement('small');note.textContent='Estimate';earned.append(note);}
  const label=cell(card,'',true);
  const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.placeholder='Not recorded';input.value=job.cost??'';input.setAttribute('aria-label','Costs for job '+job.id);
  input.addEventListener('change',()=>{const amount=Number(input.value);if(input.value!==''&&(!Number.isFinite(amount)||amount<0)){input.setCustomValidity('Enter a nonnegative cost.');input.reportValidity();return;}input.setCustomValidity('');if(input.value==='')delete costs[job.id];else costs[job.id]=Math.round(amount*100)/100;try{localStorage.setItem('fareRide_driver_costs_'+uid,JSON.stringify(costs));render();}catch{summary.textContent='Unable to save costs in this browser. Enable browser storage and retry.';}});
  label.append(input);cell(card,job.cost!==null&&job.earnings?money(job.earnings.driver-job.cost):"Pending costs",true);body.append(card);
 }
 const income=rows.reduce((sum,job)=>sum+(job.earnings?.driver||0),0), expense=rows.reduce((sum,job)=>sum+(job.cost||0),0);
 const subtotal=document.createElement('tr');subtotal.className='daily-total';const title=cell(subtotal,day+' total - '+rows.length+' jobs');title.colSpan=7;cell(subtotal,money(income),true);cell(subtotal,money(expense),true);cell(subtotal,money(income-expense)+(rows.some(job=>job.cost===null||!job.earnings)?' (provisional)':''),true);body.append(subtotal);
 }
 const foot=document.createElement('tfoot');const total=document.createElement('tr');const title=cell(total,'Period totals');title.colSpan=7;cell(total,money(report.income),true);cell(total,money(report.expenses),true);cell(total,money(report.net)+(report.missing||report.unpriced?' (provisional)':''),true);foot.append(total);table.append(foot);
 if(!report.jobs.length){const row=document.createElement('tr');const empty=cell(row,'No completed jobs in this period.');empty.colSpan=10;body.append(row);}
}
selector.addEventListener('change',render);
onAuthStateChanged(auth,async user=>{const current=++generation;stop?.();stop=null;uid=null;rides=[];costs={};list.replaceChildren();summary.textContent='Sign in as a driver to load history.';if(!user)return;try{const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;uid=user.uid;try{const saved=JSON.parse(localStorage.getItem('fareRide_driver_costs_'+uid)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))costs=saved;}catch{}summary.textContent='Loading completed jobs...';stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',uid)),snapshot=>{if(current!==generation)return;rides=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{summary.textContent='Unable to load job history. Check driver approval and Firebase ride permissions.';list.replaceChildren();});}catch{summary.textContent='Unable to verify your driver account.';}});
