(()=> {
'use strict';
const $=id=>document.getElementById(id);
const driversDefault=[
{name:'James Davis',vehicle:'Toyota Camry 2022',status:'Approved',rating:'4.94'},
{name:'Maria Santos',vehicle:'Honda Accord 2021',status:'Pending',rating:'New'},
{name:'Robert Green',vehicle:'Hyundai Sonata 2020',status:'Approved',rating:'4.89'}
];
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function show(n){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===n));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===n))}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>show(b.dataset.tab));
function getDrivers(){return JSON.parse(localStorage.getItem('fr_admin_drivers')||JSON.stringify(driversDefault))}
function renderDrivers(){
  const d=getDrivers();
  $('driversBody').innerHTML=d.map((x,i)=>`<tr><td>${x.name}</td><td>${x.vehicle}</td><td><span class="status ${x.status==='Approved'?'good':'pending'}">${x.status}</span></td><td>${x.rating}</td><td><button class="secondary approve" data-i="${i}">${x.status==='Approved'?'Approved':'Approve'}</button></td></tr>`).join('');
  document.querySelectorAll('.approve').forEach(b=>b.onclick=()=>{
    const d=getDrivers();d[+b.dataset.i].status='Approved';localStorage.setItem('fr_admin_drivers',JSON.stringify(d));renderDrivers();toast('Driver approved')
  });
}
$('addDemoDriver').onclick=()=>{const d=getDrivers();d.push({name:'New Driver '+(d.length+1),vehicle:'Vehicle pending',status:'Pending',rating:'New'});localStorage.setItem('fr_admin_drivers',JSON.stringify(d));renderDrivers();toast('Demo driver added')};

const def={baseFare:3.50,perMile:2.25,perMinute:0.35,bookingFee:2.00,minimumFare:8.00,maxMiles:250};
function loadPricing(){const p={...def,...JSON.parse(localStorage.getItem('fr_admin_pricing')||'{}')};for(const k of Object.keys(def))$(k).value=p[k]}
$('savePricing').onclick=()=>{
  const p={baseFare:+$('baseFare').value,perMile:+$('perMile').value,perMinute:+$('perMinute').value,bookingFee:+$('bookingFee').value,minimumFare:+$('minimumFare').value,maxMiles:+$('maxMiles').value};
  localStorage.setItem('fr_admin_pricing',JSON.stringify(p));
  toast('Pricing saved — Rider estimates now use these rates');
};
renderDrivers();loadPricing();
})();