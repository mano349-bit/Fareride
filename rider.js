
(() => {
'use strict';
const $=s=>document.querySelector(s);
let latestEstimate=null;

function toast(text){
  const el=$('#toast'); el.textContent=text; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2200);
}
function setLoading(on){
  $('#estimateBtn').classList.toggle('loading',on);
  $('#estimateBtn').textContent=on?'Calculating route…':'Calculate real fare';
}
function renderHistory(){
  const rides=JSON.parse(localStorage.getItem('fr_real_rides')||'[]');
  $('#historyBody').innerHTML=rides.length
    ? rides.map(r=>`<tr><td>${r.date}</td><td>${r.origin} → ${r.destination}</td><td>${r.distanceMiles} mi</td><td>${r.customQuoteRequired?'Custom quote':'$'+r.fare}</td><td><span class="status good">${r.status}</span></td></tr>`).join('')
    : '<tr><td colspan="5">No rides requested yet.</td></tr>';
}
async function estimate(){
  const origin=$('#pickup').value.trim();
  const destination=$('#dropoff').value.trim();
  const rideType=$('#rideType').value;
  if(!origin||!destination){toast('Enter pickup and destination');return}
  setLoading(true);
  try{
    const response=await fetch('/api/fare-estimate',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({origin,destination,rideType})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Unable to calculate fare');
    latestEstimate={...data,origin,destination,rideType};
    $('#distance').textContent=`${data.distanceMiles} mi`;
    $('#duration').textContent=`${data.durationMinutes} min`;
    $('#fare').textContent=data.customQuoteRequired?'Custom quote':`$${data.fare}`;
    $('#quoteBox').classList.toggle('hidden',!data.customQuoteRequired);
    $('#quoteBox').textContent=data.message||'';
    $('#requestBtn').classList.toggle('hidden',data.customQuoteRequired);
    $('#resultArea').classList.remove('hidden');
  }catch(err){
    toast(err.message);
  }finally{
    setLoading(false);
  }
}
$('#estimateBtn').addEventListener('click',estimate);
$('#rideForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!latestEstimate){toast('Calculate the fare first');return}
  try{
    const response=await fetch('/api/create-ride',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(latestEstimate)
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'Unable to create ride');
    const rides=JSON.parse(localStorage.getItem('fr_real_rides')||'[]');
    rides.unshift({...latestEstimate,date:new Date().toLocaleString(),status:'Requested',rideId:data.rideId});
    localStorage.setItem('fr_real_rides',JSON.stringify(rides));
    renderHistory();toast('Ride request created');
  }catch(err){toast(err.message)}
});
renderHistory();
})();
