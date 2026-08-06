(() => {
const F=window.FareRide;F.tabs();F.currentUser('driver');
const requests=[
 {rider:'Sarah M.',pickup:'Times Square',dropoff:'JFK Airport',distance:'14.2 mi',fare:'$48.50'},
 {rider:'David K.',pickup:'5th Avenue',dropoff:'Brooklyn Heights',distance:'7.8 mi',fare:'$27.20'},
 {rider:'Linda R.',pickup:'Queens Center',dropoff:'LaGuardia Airport',distance:'5.5 mi',fare:'$19.80'}
];
function render(){
 requestList.innerHTML=requests.map((r,i)=>`<div class="request-card"><strong>${r.rider}</strong><div class="fare">${r.fare}</div><div class="route"><span>📍 ${r.pickup}</span><span>🏁 ${r.dropoff}</span><span>${r.distance}</span></div><button class="primary accept" data-i="${i}">Accept ride</button></div>`).join('');
 document.querySelectorAll('.accept').forEach(btn=>btn.onclick=()=>{btn.textContent='Accepted';btn.disabled=true;F.toast('Ride accepted')});
}
online.onchange=e=>{onlineText.textContent=e.target.checked?'Online':'Offline';F.toast(e.target.checked?'You are online':'You are offline')};
saveVehicle.onclick=()=>F.toast('Vehicle saved');
render();
})();
