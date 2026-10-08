import {vehicleIcon,escapeHTML} from './ride-ui.js';
import './ride-live.js';
// Keep a map available before acceptance and after the live trip ends.
const liveMap=document.querySelector('#rideLiveMap');
const liveSection=liveMap?.closest('section');
const panel=document.createElement('section');panel.className='card';
panel.style.cssText='margin:20px auto;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:12px';
panel.innerHTML='<h2>Your rider map</h2><p role="status">Your live ride map appears here once a driver accepts your request.</p><button type="button" style="padding:12px 16px;margin-bottom:12px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700">Share my location</button><div id="riderPreviewMap" style="height:360px;width:100%;border-radius:10px"></div>';
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
const share=panel.querySelector('button');
function shareLocation(){
 if(!navigator.geolocation){message.textContent='Location is unavailable on this device.';return;}
 share.disabled=true;message.textContent='Getting your GPS location...';
 navigator.geolocation.getCurrentPosition(position=>{
 share.disabled=false;
 if(!map)return;
 const point=[position.coords.latitude,position.coords.longitude];
 window.dispatchEvent(new CustomEvent("fareride-rider-position",{detail:{lat:point[0],lng:point[1]}}));
 if(marker)marker.setLatLng(point);else marker=L.marker(point).addTo(map).bindTooltip('Your location');map.setView(point,13);message.textContent='Your GPS location is shown. It shares with your assigned driver automatically during an active ride.';
},()=>{share.disabled=false;message.textContent='Allow location access to center the map on you. Your live ride map appears once a driver accepts.';},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
share.onclick=shareLocation;
shareLocation();
window.addEventListener('pageshow',showMap);

let nearbyMarkers=[];
window.addEventListener('fareride-nearby-drivers',event=>{
 nearbyMarkers.forEach(marker=>marker.remove());nearbyMarkers=[];if(!map)return;
 event.detail.forEach((driver,index)=>{const label=(index+1)+'. '+driver.driverName+' — '+driver.miles.toFixed(1)+' mi';nearbyMarkers.push(L.marker([driver.lat,driver.lng],{icon:L.divIcon({html:vehicleIcon(driver.serviceType),className:'fareride-map-icon',iconSize:[40,36],iconAnchor:[20,18]})}).addTo(map).bindTooltip(escapeHTML(label)));});
});
