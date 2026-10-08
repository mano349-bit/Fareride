import {dailyExpenses} from './driver-daily-expenses.js';
import {localDay} from './rider-history-dates.js';
import { auth, db, doc, getDoc, collection, query, where, onSnapshot, onAuthStateChanged } from './firebase-session.js';
import { driverReport } from './driver-report.js';
const panel = document.createElement('section'); panel.className='card';
panel.innerHTML='<h2>My completed jobs and earnings</h2><div class="earnings-dates"><label>Start date <input id="earningsStart" type="date" required></label><label>End date <input id="earningsEnd" type="date" required></label><button id="earningsToday" type="button">Today</button></div><p id="earningsSummary" role="status">Sign in as a driver to load history.</p><p>Daily expenses default to 30% of your earnings, including tips. Edit each daily expense amount for fuel, tolls and other expenses; clear it to restore the estimate. Expenses are saved only in this browser under your account. Earnings use recorded payouts or an estimate of 75% of fare plus tips. Totals are not payment confirmations.</p><div id="earningsJobs"></div>';
panel.classList.add('driver-history');
const style = document.createElement('style');
style.textContent = '.driver-history{margin-top:24px}.earnings-dates{display:flex;flex-wrap:wrap;gap:16px;align-items:end}.earnings-dates label{display:flex;flex-direction:column;gap:6px}.earnings-dates input{padding:9px;border:1px solid #cbd5e1;border-radius:8px}.driver-history #earningsSummary{padding:16px;background:#eff6ff;border-radius:10px;font-weight:700;line-height:1.8}.earnings-table-wrap{overflow-x:auto;border:1px solid #dbe3ee;border-radius:12px}.earnings-table{width:100%;border-collapse:collapse;min-width:780px;font-size:14px}.earnings-table caption{text-align:left;padding:14px;font-weight:700}.earnings-table th{background:#eaf2ff;color:#173b68;text-align:left;white-space:nowrap}.earnings-table th,.earnings-table td{padding:13px 14px;border:1px solid #aab8ca}.earnings-table tbody tr:nth-child(even){background:#f8fafc}.earnings-table .amount{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.earnings-table .daily-total,.earnings-table tfoot{background:#eef6ff;font-weight:700}.earnings-table input{width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:7px}.earnings-table .job-id{display:block;width:270px;max-width:100%;margin-top:8px;font-family:monospace;font-size:12px;background:#f8fafc;color:#173b68}.earnings-table small{display:block;color:#64748b;font-size:11px}';
document.head.append(style);
document.querySelector('main').append(panel);
const startDate=panel.querySelector('#earningsStart'),endDate=panel.querySelector('#earningsEnd');startDate.value=endDate.value=localDay();
const summary=panel.querySelector('#earningsSummary'), list=panel.querySelector('#earningsJobs');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let uid=null, rides=[], costs={}, dailyCosts={}, stop=null, generation=0;
function render(){
 if(!uid)return;
 const report=driverReport(rides,uid,costs,{start:startDate.value,end:endDate.value});
 if(!report){list.replaceChildren();summary.textContent='Choose valid dates with the end date on or after the start date.';return;}
 const daily=dailyExpenses(report.jobs,dailyCosts);
 summary.textContent=report.jobs.length+' completed jobs | Earnings: '+money(report.income)+' | Daily expenses: '+money(daily.expenses)+' | '+(daily.days.some(day=>day.estimated)||report.unpriced?'Provisional net: ':'Net: ')+money(daily.net)+(report.unpriced?' | Unpriced jobs excluded: '+report.unpriced:'');
 list.replaceChildren();
 const wrap=document.createElement('div');wrap.className='earnings-table-wrap';
 const table=document.createElement('table');table.className='earnings-table';
 table.innerHTML='<caption>Completed jobs - '+startDate.value+' to '+endDate.value+'</caption><thead><tr><th scope="col">Job #</th><th scope="col">Date / time</th><th scope="col">Job / route</th><th scope="col">Fare</th><th scope="col">Tip</th><th scope="col">Your rating from rider</th><th scope="col">Rider comment</th><th scope="col">My earnings</th><th scope="col">Driver expense ($)</th><th scope="col">Net profit</th></tr></thead>';
 const body=document.createElement('tbody');table.append(body);wrap.append(table);list.append(wrap);
 function cell(row,text,amount=false){const td=document.createElement('td');td.textContent=text;if(amount)td.className='amount';row.append(td);return td;}
 for(const dayTotal of daily.days){
 const day=dayTotal.day,rows=dayTotal.jobs;
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
  const share=dayTotal.income?dayTotal.expense*(job.earnings?.driver||0)/dayTotal.income:dayTotal.expense/rows.length;
  cell(card,money(share),true);cell(card,job.earnings?money(job.earnings.driver-share):'Unpriced',true);body.append(card);
 }
 const subtotal=document.createElement('tr');subtotal.className='daily-total';const title=cell(subtotal,day+' total - '+rows.length+' jobs');title.colSpan=7;cell(subtotal,money(dayTotal.income),true);
 const expenseCell=cell(subtotal,'',true),expenseLabel=document.createElement('label');expenseLabel.textContent='Daily driver expense';expenseLabel.style.cssText='display:flex;flex-direction:column;gap:6px;text-align:left';const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.value=dayTotal.expense.toFixed(2);input.setAttribute('aria-label','Daily expense for '+day);
 input.onchange=()=>{const value=Number(input.value);if(input.value!==''&&(!input.checkValidity()||!Number.isFinite(value)||value<0)){input.reportValidity();return;}const next={...dailyCosts};if(input.value==='')delete next[day];else next[day]=Math.round(value*100)/100;try{localStorage.setItem('fareRide_driver_daily_costs_'+uid,JSON.stringify(next));dailyCosts=next;render();}catch{summary.textContent='Unable to save daily expenses in this browser.';}};
 expenseLabel.append(input);expenseCell.append(expenseLabel);const note=document.createElement('small');note.textContent=dayTotal.estimated?'30% estimate':'Your daily expense';expenseCell.append(note);cell(subtotal,money(dayTotal.net),true);body.append(subtotal);
 }
 const foot=document.createElement('tfoot');const total=document.createElement('tr');const title=cell(total,'Period totals');title.colSpan=7;cell(total,money(report.income),true);cell(total,money(daily.expenses),true);cell(total,money(daily.net)+(daily.days.some(day=>day.estimated)||report.unpriced?' (provisional)':''),true);foot.append(total);table.append(foot);
 if(!report.jobs.length){const row=document.createElement('tr');const empty=cell(row,'No completed jobs in this period.');empty.colSpan=10;body.append(row);}
}
startDate.addEventListener('change',render);endDate.addEventListener('change',render);panel.querySelector('#earningsToday').onclick=()=>{startDate.value=endDate.value=localDay();render();};
onAuthStateChanged(auth,async user=>{const current=++generation;stop?.();stop=null;uid=null;rides=[];costs={};dailyCosts={};list.replaceChildren();summary.textContent='Sign in as a driver to load history.';if(!user)return;try{const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;uid=user.uid;try{const savedDaily=JSON.parse(localStorage.getItem('fareRide_driver_daily_costs_'+uid)||'{}');if(savedDaily&&typeof savedDaily==='object'&&!Array.isArray(savedDaily))dailyCosts=savedDaily;}catch{}try{const saved=JSON.parse(localStorage.getItem('fareRide_driver_costs_'+uid)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))costs=saved;}catch{}summary.textContent='Loading completed jobs...';stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',uid)),snapshot=>{if(current!==generation)return;rides=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{summary.textContent='Unable to load job history. Check driver approval and Firebase ride permissions.';list.replaceChildren();});}catch{summary.textContent='Unable to verify your driver account.';}});
