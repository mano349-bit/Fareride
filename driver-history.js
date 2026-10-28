import {periodForDays,periodDayCount} from './earnings-period.js';
import {tollAmount} from './toll-accounting.js';
import {dailyExpenses} from './driver-daily-expenses.js?v=20261028-tolls';
import {localDay} from './rider-history-dates.js';
import { auth, db, doc, getDoc, collection, query, where, onSnapshot, onAuthStateChanged } from './firebase-session.js';
import { driverReport } from './driver-report.js?v=20261028-period-tolls';
const panel = document.createElement('section'); panel.className='card';
panel.innerHTML='<h2>My completed jobs and earnings</h2><div class="earnings-dates"><label>Start date <input id="earningsStart" type="date" required></label><label>End date <input id="earningsEnd" type="date" required></label><label>Days (1–365) <input id="earningsDays" type="number" min="1" max="365" step="1" value="1" required></label><button id="earningsApplyDays" type="button">Apply days</button><button id="earningsToday" type="button">Today</button></div><p id="earningsSummary" role="status">Sign in as a driver to load history.</p><p>Each ride’s expense defaults to one-third (1/3) of your earnings for that ride, including tips, excluding toll reimbursements. Increase or decrease the expense in each ride’s row; clear it to restore the default. Daily and period totals update automatically. Expenses are saved only in this browser under your account. Earnings use recorded payouts or an estimate of 75% of fare plus tips plus 100% of tolls. Totals are not payment confirmations.</p><div id="earningsJobs"></div>';
panel.classList.add('driver-history');
const style = document.createElement('style');
style.textContent = '.driver-history{margin-top:24px}.earnings-dates{display:flex;flex-wrap:wrap;gap:16px;align-items:end}.earnings-dates label{display:flex;flex-direction:column;gap:6px}.earnings-dates input{padding:9px;border:1px solid #cbd5e1;border-radius:8px}.driver-history #earningsSummary{padding:16px;background:#eff6ff;border-radius:10px;font-weight:700;line-height:1.8}.earnings-table-wrap{overflow-x:auto;border:1px solid #dbe3ee;border-radius:12px}.earnings-table{width:100%;border-collapse:collapse;min-width:0;font-size:14px}.earnings-table caption{text-align:left;padding:14px;font-weight:700}.earnings-table th{background:#eaf2ff;color:#173b68;text-align:left;white-space:nowrap}.earnings-table th,.earnings-table td{padding:13px 14px;border:1px solid #aab8ca}.earnings-table tbody tr:nth-child(even){background:#f8fafc}.earnings-table .amount{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.earnings-table .daily-total,.earnings-table tfoot{background:#eef6ff;font-weight:700}.earnings-table input{width:110px;padding:8px;border:1px solid #cbd5e1;border-radius:7px}.earnings-table .job-id{display:block;width:270px;max-width:100%;margin-top:8px;font-family:monospace;font-size:12px;background:#f8fafc;color:#173b68}.earnings-table small{display:block;color:#64748b;font-size:11px}';
style.textContent += '.earnings-job-summary p{margin:0 0 6px}.earnings-job-summary p:last-child{margin-bottom:0}.earnings-job-details[hidden]{display:none!important}.earnings-job-details .details-box p{margin:6px 0}';
document.head.append(style);
document.querySelector('main').append(panel);
const startDate=panel.querySelector('#earningsStart'),endDate=panel.querySelector('#earningsEnd');startDate.value=endDate.value=localDay();
const summary=panel.querySelector('#earningsSummary'), list=panel.querySelector('#earningsJobs');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let uid=null, rides=[], costs={}, stop=null, generation=0;
function render(){
 if(!uid)return;
 const days=periodDayCount(startDate.value,endDate.value);
 if(days===null){list.replaceChildren();summary.textContent='Choose a valid date range from 1 to 365 days.';return;}
 panel.querySelector('#earningsDays').value=days;
 const report=driverReport(rides,uid,costs,{start:startDate.value,end:endDate.value});
 if(!report){list.replaceChildren();summary.textContent='Choose valid dates with the end date on or after the start date.';return;}
 const daily=dailyExpenses(report.jobs,costs);
 summary.textContent=report.jobs.length+' completed jobs | Earnings: '+money(report.income)+' | Toll reimbursements: '+money(report.tolls)+' | Expenses: '+money(daily.expenses)+' | '+(daily.days.some(day=>day.estimated)||report.unpriced?'Provisional net: ':'Net: ')+money(daily.net)+(report.unpriced?' | Unpriced jobs excluded: '+report.unpriced:'');
 list.replaceChildren();
 const wrap=document.createElement('div');wrap.className='earnings-table-wrap';
 const table=document.createElement('table');table.className='earnings-table';
 table.innerHTML='<colgroup><col style="width:30%"><col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%"></colgroup><caption>Completed jobs - '+startDate.value+' to '+endDate.value+'</caption><thead><tr><th scope="col">Job information</th><th scope="col">Fare</th><th scope="col">Tip</th><th scope="col">Toll</th><th scope="col">Your rating from rider</th><th scope="col">Rider comment</th><th scope="col">My earnings</th><th scope="col">Driver expense ($)</th><th scope="col">Net profit</th><th scope="col">Details</th></tr></thead>';
 const body=document.createElement('tbody');table.append(body);wrap.append(table);list.append(wrap);
 function cell(row,text,amount=false){const td=document.createElement('td');td.textContent=text;if(amount)td.className='amount';row.append(td);return td;}
 for(const dayTotal of daily.days){
 const day=dayTotal.day,rows=dayTotal.jobs;
 for(const job of rows){
  const card=document.createElement('tr');
  const info=cell(card,''),infoBox=document.createElement('div');infoBox.className='earnings-job-summary';
  const infoFields=[['Job #',job.jobNumber],['Completed',job.date.toLocaleDateString()+' '+job.date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})],['Pickup',job.pickup||'Pickup'],['Destination',job.dropoff||'Destination'],['Job ID',job.id]];
  for(const [label,value] of infoFields){const line=document.createElement('p'),name=document.createElement('strong');name.textContent=label+': ';line.append(name,document.createTextNode(String(value)));infoBox.append(line);}
  info.append(infoBox);
  cell(card,job.fare!=null?money(Number(job.fare)):'Unpriced',true);
  cell(card,money(Number(job.tipAmount)||0),true);
  cell(card,money(tollAmount(job)),true);
  cell(card,job.driverRating ? job.driverRating+' / 5' : 'Not rated');
  const commentCell=cell(card,job.driverComment || 'No comment');commentCell.style.cssText='min-width:0;white-space:pre-wrap;overflow-wrap:anywhere';
  const earned=cell(card,job.earnings?money(job.earnings.driver):'Unpriced',true);if(job.earnings?.estimated){const note=document.createElement('small');note.textContent='Estimate';earned.append(note);}
  const expenseCell=cell(card,'',true),expenseLabel=document.createElement('label');expenseLabel.textContent='Ride expense';expenseLabel.style.cssText='display:flex;flex-direction:column;gap:6px;text-align:left';
  const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.inputMode='decimal';input.value=job.expenseKnown?job.expense.toFixed(2):'';input.setAttribute('aria-label','Expense for job '+job.jobNumber);input.dataset.jobExpense=job.id;
  input.onchange=()=>{
   if(auth.currentUser?.uid!==uid)return;
   const value=Number(input.value);
   if(input.value!==''&&(!input.checkValidity()||!Number.isFinite(value)||value<0)){input.reportValidity();return;}
   const next={...costs};if(input.value==='')delete next[job.id];else next[job.id]=Math.round(value*100)/100;
   try{localStorage.setItem('fareRide_driver_costs_'+uid,JSON.stringify(next));costs=next;render();}
   catch{summary.textContent='Unable to save this ride’s expense in this browser.';}
  };
  expenseLabel.append(input);expenseCell.append(expenseLabel);
  const expenseNote=document.createElement('small');expenseNote.textContent=!job.expenseKnown?'Enter expense':job.expenseEstimated?'1/3 default':'Your ride expense';expenseCell.append(expenseNote);
  cell(card,job.net!==null?money(job.net):'Unpriced',true);
  const actions=cell(card,''),detailButton=document.createElement('button');
  detailButton.type='button';detailButton.textContent='Details';detailButton.style.cssText='width:100%;min-width:0;background:#0875e1';detailButton.setAttribute('aria-expanded','false');
  const detailRow=document.createElement('tr');detailRow.hidden=true;detailRow.className='earnings-job-details';detailRow.id='earnings-details-'+job.jobNumber;
  detailButton.setAttribute('aria-controls',detailRow.id);
  const detailCell=cell(detailRow,'');detailCell.colSpan=10;
  const box=document.createElement('div');box.className='details-box';
  const fields=[['Job ID',job.id],['Rider',job.riderName],['Driver',job.driverName],['Service',job.serviceType==='tow'?'Tow truck':job.serviceType==='messenger'?'Bike delivery':'Passenger ride'],['Pickup',job.pickup],['Destination',job.dropoff],['Miles',job.miles],['Fare',job.fare!=null?money(job.fare):'Unpriced'],['Tip',money(Number(job.tipAmount)||0)],['Toll reimbursement (100%)',money(job.earnings?.tolls || 0)],['Earnings',job.earnings?money(job.earnings.driver):'Unpriced'],['Expense',job.expenseKnown?money(job.expense):'Unknown'],['Net',job.net!==null?money(job.net):'Unpriced'],['Requested',job.requestedAt],['Accepted',job.acceptedAt],['Started',job.startedAt],['Arrived at pickup',job.arrivedAt],['Completed',job.date.toLocaleString()],['Rider rating',job.driverRating?job.driverRating+' / 5':'Not rated'],['Rider comment',job.driverComment||'No comment']];
  for(const [label,value] of fields){if(value===null||value===undefined||value==='')continue;const line=document.createElement('p'),title=document.createElement('strong');title.textContent=label+': ';line.append(title,document.createTextNode(String(value)));box.append(line);}
  detailCell.append(box);detailButton.onclick=()=>{detailRow.hidden=!detailRow.hidden;detailButton.setAttribute('aria-expanded',String(!detailRow.hidden));detailButton.textContent=detailRow.hidden?'Details':'Hide details';};actions.append(detailButton);body.append(card,detailRow);
 }
 const subtotal=document.createElement('tr');subtotal.className='daily-total';const title=cell(subtotal,day+' total - '+rows.length+' jobs');title.colSpan=3;cell(subtotal,money(rows.reduce((sum,job)=>sum+tollAmount(job),0)),true);const meta=cell(subtotal,'');meta.colSpan=2;cell(subtotal,money(dayTotal.income),true);
 cell(subtotal,money(dayTotal.expense),true);cell(subtotal,money(dayTotal.net)+(dayTotal.estimated?' Total-Net':''),true);cell(subtotal,'');body.append(subtotal);
 }
 const foot=document.createElement('tfoot');const total=document.createElement('tr');const title=cell(total,'Period totals');title.colSpan=3;cell(total,money(report.jobs.reduce((sum,job)=>sum+(job.earnings?.tolls||0),0)),true);const meta=cell(total,'');meta.colSpan=2;cell(total,money(report.income),true);cell(total,money(daily.expenses),true);cell(total,money(daily.net)+(daily.days.some(day=>day.estimated)||report.unpriced?' Total-Net':''),true);cell(total,'');foot.append(total);table.append(foot);
 if(!report.jobs.length){const row=document.createElement('tr');const empty=cell(row,'No completed jobs in this period.');empty.colSpan=10;body.append(row);}
}
startDate.addEventListener('change',render);endDate.addEventListener('change',render);panel.querySelector('#earningsToday').onclick=()=>{startDate.value=endDate.value=localDay();panel.querySelector('#earningsDays').value=1;render();};
panel.querySelector('#earningsApplyDays').onclick=()=>{const input=panel.querySelector('#earningsDays');if(!input.reportValidity())return;const period=periodForDays(endDate.value||localDay(),Number(input.value));if(!period)return;startDate.value=period.start;endDate.value=period.end;render();};
onAuthStateChanged(auth,async user=>{const current=++generation;stop?.();stop=null;uid=null;rides=[];costs={};list.replaceChildren();summary.textContent='Sign in as a driver to load history.';if(!user)return;try{const profile=await getDoc(doc(db,'users',user.uid));if(current!==generation)return;if(!profile.exists()||profile.data().role!=='driver')return;uid=user.uid;try{const saved=JSON.parse(localStorage.getItem('fareRide_driver_costs_'+uid)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))costs=saved;}catch{}summary.textContent='Loading completed jobs...';stop=onSnapshot(query(collection(db,'rides'),where('driverId','==',uid)),snapshot=>{if(current!==generation)return;rides=snapshot.docs.map(d=>({...d.data(),id:d.id}));render();},()=>{summary.textContent='Unable to load job history. Check driver approval and Firebase ride permissions.';list.replaceChildren();});}catch{summary.textContent='Unable to verify your driver account.';}});

