(() => {
const F=window.FareRide;F.tabs();F.currentUser('admin');
const drivers=[
 {name:'James Davis',vehicle:'Toyota Camry 2022',status:'Approved',rating:'4.94'},
 {name:'Maria Santos',vehicle:'Honda Accord 2021',status:'Pending',rating:'New'},
 {name:'Robert Green',vehicle:'Hyundai Sonata 2020',status:'Approved',rating:'4.89'}
];
function renderDrivers(){
 driversBody.innerHTML=drivers.map((d,i)=>`<tr><td>${d.name}</td><td>${d.vehicle}</td><td><span class="status ${d.status==='Approved'?'good':'pending'}">${d.status}</span></td><td>${d.rating}</td><td><button class="secondary approve" data-i="${i}">${d.status==='Approved'?'View':'Approve'}</button></td></tr>`).join('');
 document.querySelectorAll('.approve').forEach(btn=>btn.onclick=()=>{drivers[btn.dataset.i].status='Approved';renderDrivers();F.toast('Driver approved')});
}
const p=F.read(F.KEYS.pricing,{base:3.5,mile:2.25,minute:.35,minimum:8});
baseFare.value=p.base;perMile.value=p.mile;perMinute.value=p.minute;minimumFare.value=p.minimum;
savePricing.onclick=()=>{F.write(F.KEYS.pricing,{base:+baseFare.value,mile:+perMile.value,minute:+perMinute.value,minimum:+minimumFare.value});F.toast('Pricing saved')};
renderDrivers();
})();
