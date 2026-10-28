import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function harness(){
 const elements=new Map(),events=new Map(),requests=[],saved=new Map();let routeResponse=null,profileWait=null;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{id,value:'',hidden:true,disabled:false,textContent:'',style:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},closest(){return element(id+'Label');}});
  return elements.get(id);
 };
 element('pickup').value='lga';element('dropoff').value='jfk';element('rideType').value='economy';
 const context=vm.createContext({
  console,URL,Number,Intl,Math,Date,JSON,Map,crypto:{randomUUID:()=> 'new-job'},setTimeout,clearTimeout,AbortController,
  auth:{currentUser:{uid:'r'}},db:{},doc:(_db,collection,id)=>({collection,id}),setDoc:async()=>{},getDoc:()=>profileWait||Promise.resolve({exists:()=>true,data:()=>({fullName:'Rider'})}),
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)},
  document:{getElementById:element,querySelector:()=>({value:'ride'}),querySelectorAll:()=>[]},
  window:{addEventListener:(type,fn)=>events.set(type,fn),dispatchEvent(){}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Event:class{constructor(type){this.type=type;}},
  createVehiclePicker:()=>({setActive(){},description(){return '';}}),validateServiceDetails:()=>({}),SERVICES:{ride:{action:'Request ride'}},TOW_PRICING:{},calculateTowFare:()=>0,
  priceLabel:(ride,money)=>money(ride.fare),liveSnapshot:()=>()=>{},
  fetch:async input=>{
   const url=String(input);requests.push(url);
   if(url.includes('nominatim'))return {ok:true,json:async()=>url.includes('LaGuardia')?[{lat:'40.7769',lon:'-73.8740'}]:[{lat:'40.6413',lon:'-73.7781'}]};
   if(routeResponse)return routeResponse;
   return {ok:true,json:async()=>({code:'Ok',routes:[{distance:11.96*1609.344,duration:1200}]})};
  }
 });
 const source=fs.readFileSync('rider.js','utf8').replace(/^import[\s\S]*?from\s*["'][^"']+["'];\s*/gm,'');
 vm.runInContext(source,context);
 return {context,element,events,requests,calculate:()=>context.calculateEstimate(),snapshot:ride=>context.showRideStatus({id:'old',riderId:'r',...ride}),deferRoute:response=>{routeResponse=response;},deferProfile:promise=>{profileWait=promise;},state:code=>vm.runInContext(code,context)};
}
test('airport estimate stays unchanged after unrelated completed ride snapshots',async()=>{
 const h=harness();await h.calculate();
 assert.equal(h.element('mileage').textContent,'11.96 miles');assert.equal(h.element('fare').textContent,'$30.41');assert.equal(h.element('duration').textContent,'20 min');
 h.snapshot({status:'completed',miles:1272.17,fare:2865.87,durationMinutes:1444});
 assert.equal(h.element('mileage').textContent,'11.96 miles');assert.equal(h.element('fare').textContent,'$30.41');assert.equal(h.element('duration').textContent,'20 min');
 assert(h.requests.some(url=>url.includes('LaGuardia')));assert(h.requests.some(url=>url.includes('John+F.+Kennedy')));assert(h.requests.filter(url=>url.includes('nominatim')).every(url=>url.includes('countrycodes=us')));
});
test('active ride updates cannot overwrite a new draft or enable another request',async()=>{
 const h=harness();await h.calculate();h.snapshot({status:'started',miles:1272.17,fare:2865.87,durationMinutes:1444});
 assert.equal(h.element('fare').textContent,'$30.41');assert.equal(h.element('requestBtn').disabled,true);
 h.element('rideForm').handlers.input();h.snapshot({status:'completed',miles:1272.17,fare:2865.87});assert.equal(h.element('summary').hidden,true);assert.equal(h.element('requestBtn').disabled,true);
});
test('changing ride type recalculates even after input invalidates the estimate',async()=>{
 const h=harness();await h.calculate();h.element('rideType').value='xl';h.element('rideForm').handlers.input();h.element('rideType').onchange();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(h.element('mileage').textContent,'11.96 miles');assert.equal(h.element('fare').textContent,'$45.62');
});
test('in-flight estimate cannot overwrite a changed form',async()=>{
 const h=harness();let resolve;h.deferRoute(new Promise(r=>resolve=r));const calculating=h.calculate();
 await new Promise(r=>setTimeout(r,0));h.element('pickup').value='different pickup';h.element('rideForm').handlers.input();
 resolve({ok:true,json:async()=>({code:'Ok',routes:[{distance:1000,duration:120}]})});await calculating;
 assert.equal(h.state('estimate'),null);assert.equal(h.element('summary').hidden,true);
});
test('changing booking while rider profile loads prevents an outdated request',async()=>{
 const h=harness();await h.calculate();let resolve;h.deferProfile(new Promise(r=>resolve=r));const submitting=h.element('rideForm').onsubmit({preventDefault(){}});
 h.element('dropoff').value='another destination';h.element('rideForm').handlers.input();resolve({exists:()=>true,data:()=>({fullName:'Rider'})});await submitting;
 assert.equal(h.state('submitting'),false);assert.equal(h.element('requestBtn').disabled,true);
});

test('airport aliases reject a geocoder result outside the New York region',async()=>{
 const h=harness();h.context.fetch=async()=>({ok:true,json:async()=>[{lat:'25.9',lon:'-80.1'}]});
 await assert.rejects(h.context.geocode('lga'),/unexpected location/);
});
