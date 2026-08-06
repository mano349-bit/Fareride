(() => {
const F=window.FareRide; F.tabs();
const user=F.currentUser('rider');
document.querySelector('#profileBtn').textContent=user.name;
function pricing(){return F.read(F.KEYS.pricing,{base:3.5,mile:2.25,minute:0.35,minimum:8})}
function render(){
  const rides=F.read(F.KEYS.rides,[]).filter(r=>r.riderId===user.id);
  const body=document.querySelector('#historyBody');
  body.innerHTML=(rides.length?rides:[{date:'Jul 28, 2026',pickup:'Downtown',dropoff:'Airport',driver:'James D.',fare:'$34.80',status:'Completed'}])
  .map(r=>`<tr><td>${r.date}</td><td>${r.pickup} → ${r.dropoff}</td><td>${r.driver||'Searching'}</td><td>${r.fare}</td><td><span class="status good">${r.status}</span></td></tr>`).join('');
}
document.querySelector('#rideForm').addEventListener('submit',e=>{
  e.preventDefault();
  const p=pricing(),distance=7.4,minutes=18,amount=Math.max(p.minimum,p.base+distance*p.mile+minutes*p.minute);
  const ride={id:'FR-'+Date.now(),riderId:user.id,date:new Date().toLocaleString(),pickup:pickup.value.trim(),dropoff:dropoff.value.trim(),driver:'James D.',fare:'$'+amount.toFixed(2),status:'Driver assigned'};
  const rides=F.read(F.KEYS.rides,[]);rides.unshift(ride);F.write(F.KEYS.rides,rides);
  document.querySelector('#currentRoute').textContent=`${ride.pickup} → ${ride.dropoff}`;
  render();F.toast('Ride requested');document.querySelector('[data-tab="current"]').click();
});
document.querySelector('#cancelRide').onclick=()=>F.toast('Ride cancelled');
render();
})();
