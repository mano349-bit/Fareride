(()=> {
'use strict';
const $=id=>document.getElementById(id);

const driversDefault=[
  {name:'James Davis',vehicle:'Toyota Camry 2022',status:'Approved',rating:'4.94'},
  {name:'Maria Santos',vehicle:'Honda Accord 2021',status:'Pending',rating:'New'},
  {name:'Robert Green',vehicle:'Hyundai Sonata 2020',status:'Approved',rating:'4.89'}
];

function toast(text){
  const e=$('toast');
  e.textContent=text;
  e.classList.add('show');
  setTimeout(()=>e.classList.remove('show'),1800);
}

function showTab(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

function getDrivers(){
  return JSON.parse(localStorage.getItem('fr_admin_drivers')||JSON.stringify(driversDefault));
}
function saveDrivers(drivers){
  localStorage.setItem('fr_admin_drivers',JSON.stringify(drivers));
}
function renderDrivers(){
  const drivers=getDrivers();
  $('driversBody').innerHTML=drivers.map((d,i)=>`
    <tr>
      <td>${d.name}</td>
      <td>${d.vehicle}</td>
      <td><span class="status ${d.status==='Approved'?'good':'pending'}">${d.status}</span></td>
      <td>${d.rating}</td>
      <td><button class="secondary approve" data-i="${i}">${d.status==='Approved'?'Approved':'Approve'}</button></td>
    </tr>`).join('');

  document.querySelectorAll('.approve').forEach(btn=>btn.onclick=()=>{
    const drivers=getDrivers();
    const i=Number(btn.dataset.i);
    drivers[i].status='Approved';
    saveDrivers(drivers);
    renderDrivers();
    toast('Driver approved');
  });
}

$('addDemoDriver').onclick=()=>{
  const drivers=getDrivers();
  drivers.push({name:'New Driver '+(drivers.length+1),vehicle:'Vehicle pending',status:'Pending',rating:'New'});
  saveDrivers(drivers);
  renderDrivers();
  toast('Demo driver added');
};

const pricingDefault={
  baseFare:3.50,
  perMile:2.25,
  perMinute:0.35,
  bookingFee:2.00,
  minimumFare:8.00,
  maxMiles:250
};

function loadPricing(){
  const p=JSON.parse(localStorage.getItem('fr_admin_pricing')||JSON.stringify(pricingDefault));
  $('baseFare').value=p.baseFare;
  $('perMile').value=p.perMile;
  $('perMinute').value=p.perMinute;
  $('bookingFee').value=p.bookingFee;
  $('minimumFare').value=p.minimumFare;
  $('maxMiles').value=p.maxMiles;
}
$('savePricing').onclick=()=>{
  const p={
    baseFare:+$('baseFare').value,
    perMile:+$('perMile').value,
    perMinute:+$('perMinute').value,
    bookingFee:+$('bookingFee').value,
    minimumFare:+$('minimumFare').value,
    maxMiles:+$('maxMiles').value
  };
  localStorage.setItem('fr_admin_pricing',JSON.stringify(p));
  toast('Pricing saved locally');
};

renderDrivers();
loadPricing();
})();