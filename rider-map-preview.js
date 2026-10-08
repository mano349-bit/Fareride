import './ride-live.js';
// Keep a map available before acceptance and after the live trip ends.
const liveMap=document.querySelector('#rideLiveMap');
const liveSection=liveMap?.closest('section');
const panel=document.createElement('section');panel.className='card';
panel.style.cssText='margin:20px auto;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:12px';
panel.innerHTML='<h2>Your rider map</h2><p role="status">Your live ride map appears here once a driver accepts your request.</p><div id="riderPreviewMap" style="height:360px;width:100%;border-radius:10px"></div>';
if(liveSection)liveSection.before(panel);else document.querySelector('main').append(panel);
const message=panel.querySelector('p');
let map=null,marker=null;
function showMap(){
 panel.hidden=Boolean(liveSection&&!liveSection.hidden);
 if(panel.hidden)return;
 if(!window.L){message.textContent='Map could not load. Check your connection and refresh the page.';return;}
 if(!map){map=L.map('riderPreviewMap').setView([39.5,-98.35],4);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);}
 requestAnimationFrame(()=>map.invalidateSize());
}
showMap();
if(liveSection)new MutationObserver(showMap).observe(liveSection,{attributes:true,attributeFilter:['hidden']});
if(navigator.geolocation)navigator.geolocation.getCurrentPosition(position=>{
 if(!map)return;
 const point=[position.coords.latitude,position.coords.longitude];
 marker=L.marker(point).addTo(map).bindTooltip('Your location');map.setView(point,13);
},()=>{message.textContent='Allow location access to center the map on you. Your live ride map appears once a driver accepts.';},{enableHighAccuracy:true,maximumAge:30000,timeout:15000});
window.addEventListener('pageshow',showMap);
