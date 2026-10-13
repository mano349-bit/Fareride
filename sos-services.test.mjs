import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {SOS_SERVICES,sosServiceLabel} from './sos-services.js';
import {sosError} from './sos-state.js';

const source = readFileSync(new URL('./sos.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
function setup(role = 'driver', overrides = {}) {
  const buttons = Object.keys(SOS_SERVICES).map(service => ({dataset:{sosService:service},disabled:false,removeAttribute(){},addEventListener(_event, callback){this.click=callback;}}));
  const result = {textContent:'',children:[],setAttribute(){},replaceChildren(){this.children=[];},append(...nodes){this.children.push(...nodes);}};
  const writes = [], confirmations = [];
  const sandbox = {
    location:{pathname:'/' + role + '.html'},
    document:{querySelectorAll:()=>buttons,querySelector:()=>({after(){}}),getElementById:()=>result,createElement:()=>({style:{}})},
    auth:{currentUser:{uid:'u'}}, db:{}, doc:(_db,...parts)=>parts,
    getDoc:async()=>({exists:()=>true,data:()=>({role,fullName:'Test User'})}),
    addDoc:async(_collection,record)=>{writes.push(record);},collection:()=>{},serverTimestamp:()=> 'timestamp',
    localStorage:{getItem:()=>null},navigator:{geolocation:{}},
    confirm:message=>{confirmations.push(message);return true;},
    getSOSLocation:async()=>({latitude:40,longitude:-73,accuracy:10}),sosError,SOS_SERVICES,sosServiceLabel,
    setTimeout,clearTimeout,...overrides
  };
  vm.runInNewContext(source, sandbox);
  return {buttons,result,writes,confirmations,sandbox};
}

test('all three services save their type for drivers and riders and show it in confirmation', async () => {
  for (const role of ['driver','rider']) {
    const ctx=setup(role);
    for (const button of ctx.buttons) {
      await button.click();
      const record=ctx.writes.at(-1), service=button.dataset.sosService;
      assert.equal(record.emergencyService,service);
      assert.equal(record.type,'SOS');assert.equal(record.source,role);assert.equal(record.reporterId,'u');assert.equal(record[role+'Id'],'u');
      assert.equal(record.latitude,40);assert.equal(record.rideId,null);
      assert.match(ctx.confirmations.at(-1),new RegExp(SOS_SERVICES[service]));
      assert.match(ctx.confirmations.at(-1),/does not contact emergency services/);
      assert.match(ctx.result.children[0].textContent,new RegExp(SOS_SERVICES[service]));
      assert.equal(ctx.buttons.some(b=>b.disabled),false);
    }
  }
});

test('only one SOS can be pending across all service buttons', async () => {
  let release;
  const ctx=setup('driver',{getSOSLocation:()=>new Promise(resolve=>{release=resolve;})});
  const pending=ctx.buttons[0].click();
  assert.equal(ctx.buttons.every(b=>b.disabled),true);
  await ctx.buttons[1].click();
  release({latitude:40,longitude:-73,accuracy:10});await pending;
  assert.equal(ctx.writes.length,1);assert.equal(ctx.writes[0].emergencyService,'police');
  assert.equal(ctx.buttons.every(b=>!b.disabled),true);
});

test('cancel, no login, unavailable GPS and account changes never save alerts', async () => {
  for (const overrides of [{confirm:()=>false},{auth:{currentUser:null}},{navigator:{}},{getSOSLocation:async()=>{throw {code:1};}}]) {
    const ctx=setup('driver',overrides);await ctx.buttons[0].click();assert.equal(ctx.writes.length,0);assert.equal(ctx.buttons.every(b=>!b.disabled),true);
  }
  const ctx=setup();ctx.sandbox.getSOSLocation=async()=>{ctx.sandbox.auth.currentUser={uid:'other'};return {latitude:40,longitude:-73,accuracy:10};};
  await ctx.buttons[0].click();assert.equal(ctx.writes.length,0);
});

test('save rejection shows the error and enables all services again', async () => {
  const ctx=setup('driver',{addDoc:async()=>{throw {code:'permission-denied'};}});
  await ctx.buttons[2].click();assert.match(ctx.result.textContent,/Firebase blocked/);assert.equal(ctx.buttons.every(b=>!b.disabled),true);
});

test('legacy or unknown service labels display General SOS', () => {
  assert.equal(sosServiceLabel(undefined),'General SOS');assert.equal(sosServiceLabel('<script>'),'General SOS');assert.equal(sosServiceLabel('toString'),'General SOS');
});

test('Admin displays selected services and legacy SOS in cards and active banner', () => {
  const nodes=new Map(['emergencyTopBanner','emergencyCount','emergencyBannerSource','emergencyBannerService','emergencyBannerRide','emergencyBannerTime','emergencyBannerMap','emergencyList'].map(id=>[id,{classList:{add(){},remove(){}},textContent:'',innerHTML:''}]));
  let receive;
  const adminSource=readFileSync(new URL('./admin-emergency.js', import.meta.url),'utf8').replace(/import[\s\S]*?from\s*["'][^"']+["'];\s*/g,'');
  vm.runInNewContext(adminSource,{sosServiceLabel,document:{getElementById:id=>nodes.get(id),querySelectorAll:()=>[]},observeAdmin:callback=>callback(true),db:{},auth:{},collection(){},doc(){},updateDoc(){},onAuthStateChanged(){},serverTimestamp(){},onSnapshot:(_query,callback)=>{receive=callback;return ()=>{};}});
  for (const emergencyService of ['police','ambulance','fire',undefined]) {
    receive({docs:[{id:'e',data:()=>({source:'driver',status:'active',emergencyService,latitude:40,longitude:-73,createdAt:{toMillis:()=>1,toDate:()=>new Date()}})}]});
    const label=sosServiceLabel(emergencyService);
    assert.equal(nodes.get('emergencyBannerService').textContent,label);
    assert.ok(nodes.get('emergencyList').innerHTML.includes(label));
    assert.ok(nodes.get('emergencyList').innerHTML.includes('Requested service'));
    assert.equal(nodes.get('emergencyCount').textContent,1);
  }
});
