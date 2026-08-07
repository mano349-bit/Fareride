(()=> {
'use strict';
const $=id=>document.getElementById(id);
let latest=null;

const defaults={baseFare:3.50,perMile:2.25,perMinute:0.35,bookingFee:2.00,minimumFare:8.00,maxMiles:250};

function getAdminPricing(){
  try{return {...defaults,...JSON.parse(localStorage.getItem('fr_admin_pricing')||'{}')}}catch{return {...defaults}}
}
function toast(t){const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function route(a,b){
  a=a.toLowerCase();b=b.toLowerCase();
  if(a.includes('times square')&&b.includes('jfk'))return{mi:16.8,min:38};
  if((a.includes('new york')||a.includes('times square'))&&b.includes('miami'))return{mi:1285,min:1140};
  if(b.includes('laguardia'))return{mi:9.7,min:26};
  if(b.includes('newark'))return{mi:17.5,min:34};
  const h=[...(a+b)].reduce((n,c)=>n+c.charCodeAt(0),0);
  const mi=3+(h%42);
  return{mi,min:Math.round(8+mi*2.1)};
}
function multiplier(type){return{economy:1,comfort:1.28,xl:1.58}[type]||1}
function history(){
  const r=JSON.parse(localStorage.getItem('fr_history')||'[]');
  $('historyBody').innerHTML=r.length?r.map(x=>`<tr><td>${x.date}</td><td>${x.a} → ${x.b}</td><td>${x.type}</td><td>${x.fare}</td><td>${x.status}</td></tr>`).join(''):'<tr><td colspan="5">No rides yet.</td></tr>'
}
$('estimateBtn').onclick=()=>{
  const a=$('pickup').value.trim(),b=$('dropoff').value.trim(),type=$('rideType').value;
  if(!a||!b)return toast('Enter pickup and destination');
  const r=route(a,b),p=getAdminPricing(),mult=multiplier(type);
  const fare=Math.max(p.minimumFare,(p.baseFare+r.mi*p.perMile+r.min*p.perMinute+p.bookingFee)*mult);
  latest={a,b,type,mi:r.mi,min:r.min,fare,maxMiles:p.maxMiles};
  $('distance').textContent=r.mi.toFixed(1)+' mi';
  $('duration').textContent=r.min+' min';
  $('fare').textContent=r.mi>p.maxMiles?'Custom quote':'$'+fare.toFixed(2);
  $('estimatePanel').classList.remove('hidden');
  $('requestBtn').classList.remove('hidden');
  $('requestBtn').disabled=r.mi>p.maxMiles;
  $('requestBtn').textContent=r.mi>p.maxMiles?'Long-distance quote required':'Request FareRide';
};
$('rideForm').onsubmit=e=>{
  e.preventDefault();
  if(!latest)return toast('Calculate estimate first');
  if(latest.mi>latest.maxMiles)return toast('This trip requires a custom quote');
  const r=JSON.parse(localStorage.getItem('fr_history')||'[]');
  r.unshift({date:new Date().toLocaleString(),a:latest.a,b:latest.b,type:latest.type,fare:'$'+latest.fare.toFixed(2),status:'Requested'});
  localStorage.setItem('fr_history',JSON.stringify(r));
  history();toast('Ride requested');
};
history();
})();