import {locationNotice} from './ride-location-notice.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ACTIVE_STATUSES, validCoordinates } from './ride-details.js';
import {phoneNumber,vehicleIcon} from './ride-ui.js';
function harness(driver){
 const elements=new Map(),listeners=[],writes=[],events={},markers=[],ticks=[],pageEvents={},positions=[];let changed,gps,cleared=0;
 const el=key=>{if(!elements.has(key))elements.set(key,{textContent:'',hidden:false,style:{},prepend(){},append(){},removeAttribute(){this.href=undefined;},querySelector:el,cloneNode(){return {...this};}});return elements.get(key);};
 const auth={currentUser:{uid:driver?'driver':'rider'}};
 const L={map:()=>({setView(){return this;},remove(){},fitBounds(){}}),tileLayer:()=>({addTo(){}}),divIcon:options=>options,latLngBounds:x=>x,marker:(point,options)=>{const m={point,options,addTo(){return this;},bindPopup(text){this.popup=text.textContent;return this;},bindTooltip(text,options){this.tooltip=text.textContent;this.tooltipOptions=options;return this;},setPopupContent(text){this.popup=text.textContent;},setTooltipContent(text){this.tooltip=text.textContent;},setLatLng(p){this.point=p;},getLatLng(){return this.point;}};markers.push(m);return m;}};
 const context=vm.createContext({auth,db:{},ACTIVE_STATUSES,validCoordinates,locationNotice,phoneNumber,vehicleIcon,L,location:{pathname:driver?'/driver.html':'/rider.html'},window:{L,addEventListener:(name,cb)=>events[name]=cb},setInterval:cb=>{ticks.push(cb);return 1;},clearInterval:()=>{},setTimeout:()=>1,document:{getElementById:()=>null,addEventListener:(name,cb)=>pageEvents[name]=cb,createElement:()=>el('section'),querySelector:()=>el('main')},navigator:{geolocation:{getCurrentPosition:cb=>positions.push(cb),watchPosition:cb=>{gps=cb;return 1;},clearWatch:()=>cleared++}},doc:(_,collection,id)=>({collection,id}),collection:(_,name)=>name,where:(...args)=>args,query:(...args)=>args,getDoc:async()=>({exists:()=>true,data:()=>({role:driver?'driver':'rider',accountStatus:'approved',fullName:'Sam Rider',phone:'(516) 376-4118'})}),onAuthStateChanged:(_,cb)=>changed=cb,onSnapshot:(ref,cb)=>{listeners.push({ref,cb});return()=>{};},updateDoc:async(ref,data)=>writes.push(data),serverTimestamp:()=>123,Date,console});
 vm.runInContext(fs.readFileSync('ride-live.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
 return {elements,listeners,writes,events,markers,auth,ticks,pageEvents,positions,login:()=>changed(auth.currentUser),position:()=>gps({coords:{latitude:40,longitude:-73,accuracy:5}}),cleared:()=>cleared};
}
test('driver discovers assigned ride without browser ride ID and sees rider name, GPS and full phone',async()=>{
 const h=harness(true);await h.login();const job={status:'accepted',riderName:'Sam Rider',riderPhone:'(516) 376-4118',driverId:'driver',riderId:'rider',riderLocation:{lat:40,lng:-73},driverLocation:{lat:40.01,lng:-73.01},serviceType:'messenger'};
 h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});
 assert.equal(h.elements.get('a').href,'tel:5163764118');assert.match(h.elements.get('#liveDriverDetails').textContent,/Sam Rider/);assert.match(h.markers[0].popup,/Sam Rider.*live/);assert.equal(h.markers[1].options.icon.html,vehicleIcon('messenger'));
 await h.position();assert.equal(h.writes[0].driverLocation.lat,40);h.listeners[1].cb({exists:()=>true,data:()=>({...job,status:'completed'})});assert.ok(h.cleared()>0);
});
test('rider shares own GPS and profile contact information for existing rides',async()=>{
 const h=harness(false);await h.login();const job={status:'started',riderName:'Rider',driverPhone:'+1 (516) 376-4118',driverId:'driver',riderId:'rider',pickupLocation:{lat:40,lng:-73}};
 h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});await h.position();
 assert.equal(h.writes[0].riderName,'Sam Rider');assert.equal(h.writes[0].riderPhone,'(516) 376-4118');assert.equal(h.writes[1].riderLocation.lng,-73);assert.equal(h.elements.get('a').href,'tel:+15163764118');
 h.events.pagehide();assert.ok(h.cleared()>0);h.events.pageshow({persisted:true});assert.equal(h.listeners.length,3);
});

test('both names stay visible through every active stage, even with missing GPS',async()=>{
 const h=harness(true);await h.login();const job={status:'accepted',driverId:'driver',riderId:'rider',driverName:'Alex Driver',riderName:'Jamie Rider',vehicleYear:'2024',vehicleMake:'Toyota',vehicleModel:'Corolla',pickupLocation:{lat:40,lng:-73},driverLocation:{lat:40,lng:-73}};
 h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});
 for(const status of ['accepted','started','arrived']){h.listeners[1].cb({exists:()=>true,data:()=>({...job,status})});assert.equal(h.elements.get('section').hidden,false);const names=h.elements.get('#rideMapPeople').textContent;assert.match(names,/Jamie Rider/);assert.match(names,/Driver:/);assert.match(names,/2024 Toyota Corolla/);}
 assert.equal(h.markers[0].tooltipOptions.permanent,true);assert.equal(h.markers[0].tooltipOptions.direction,'bottom');assert.equal(h.markers[1].tooltipOptions.permanent,true);assert.equal(h.markers[1].tooltipOptions.direction,'top');
 h.listeners[1].cb({exists:()=>true,data:()=>({...job,status:'completed'})});assert.equal(h.elements.get('section').hidden,true);
});

test('both participants see their own immediate GPS updates and refresh after returning to the page',async()=>{
 for(const driver of [true,false]){const h=harness(driver);await h.login();const job={status:'accepted',driverId:'driver',riderId:'rider',riderName:'Sam Rider',riderPhone:'(516) 376-4118',pickupLocation:{lat:39,lng:-72},driverLocation:{lat:39.5,lng:-72.5}};
 h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});await h.position();
 assert.deepEqual(Array.from(h.markers[driver?1:0].point),[40,-73]);h.ticks[0]();assert.equal(h.positions.length,1);h.pageEvents.visibilitychange();assert.equal(h.ticks.length,2);
 }
});

test('booked Hartford pickup stays separate when both live positions report West Islip',async()=>{
 const h=harness(true);await h.login();const point={lat:40.706,lng:-73.306},pickup={lat:41.77,lng:-72.70};const job={status:'accepted',driverId:'driver',riderId:'rider',pickup:'Hartford CT 06105',riderLocation:point,driverLocation:point,pickupLocation:pickup};h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});assert.deepEqual(Array.from(h.markers[2].point),[41.77,-72.70]);assert.match(h.markers[2].tooltip,/Booked pickup: Hartford/);assert.match(h.elements.get('#liveMapStatus').textContent,/same GPS location/);
});

test('driver Start Live Location controls the shared map until completion',async()=>{
 const h=harness(true);await h.login();const job={status:'accepted',driverId:'driver',riderId:'rider',pickupLocation:{lat:40,lng:-73},riderLocation:{lat:41,lng:-72},driverLocation:{lat:40,lng:-73}};h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});h.events['fareride-stop-location']();h.events['fareride-start-location']();assert.equal(h.ticks.length,2);assert.equal(h.elements.get('section').hidden,false);for(const status of ['started','arrived']){h.listeners[1].cb({exists:()=>true,data:()=>({...job,status})});assert.equal(h.elements.get('section').hidden,false);}h.listeners[1].cb({exists:()=>true,data:()=>({...job,status:'completed'})});assert.equal(h.elements.get('section').hidden,true);
});

test('rider sees driver name, full vehicle, callable phone and arriving GPS updates',async()=>{
 const h=harness(false);await h.login();const job={status:'accepted',driverId:'driver',riderId:'rider',riderName:'Sam Rider',riderPhone:'(516) 376-4118',driverName:'Alex Driver',vehicleYear:'2024',vehicleMake:'Toyota',vehicleModel:'Corolla',driverPhone:'+1 (516) 555-0123'};h.listeners[0].cb({docs:[{id:'job',data:()=>job}]});h.listeners[1].cb({exists:()=>true,data:()=>job});const text=h.elements.get('#liveDriverDetails').textContent;assert.match(text,/Alex Driver/);assert.match(text,/2024 Toyota Corolla/);assert.match(text,/Waiting for driver GPS/);assert.equal(h.elements.get('a').href,'tel:+15165550123');h.listeners[1].cb({exists:()=>true,data:()=>({...job,driverLocation:{lat:40.706,lng:-73.306}})});assert.match(h.elements.get('#liveDriverDetails').textContent,/40.70600, -73.30600/);assert.match(h.markers[0].tooltip,/Alex Driver.*Toyota/);
});
