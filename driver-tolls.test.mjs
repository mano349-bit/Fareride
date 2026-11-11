import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {tollUpdate,tollAmount,riderTotal} from './toll-accounting.js';
function harness(search=''){
 const nodes=new Map(),listeners=[],data=new Map();let login,nextId=0,failure=null,gate=null,loseResponse=false;
 const el=key=>{
  if(!nodes.has(key))nodes.set(key,{children:[],value:'',hidden:false,disabled:false,checked:false,textContent:'',handlers:{},
   append(...children){this.children.push(...children);if(key==='#tollRide'&&!this.value)this.value=children[0]?.value||'';},
   replaceChildren(...children){this.children=children;if(key==='#tollRide')this.value=children[0]?.value||'';},
   querySelector:el,setAttribute(name,value){this[name]=value;},addEventListener(type,fn){this.handlers[type]=fn;},focus(){this.focused=true;},reportValidity(){return true;},
   get options(){return this.children;},get valueAsNumber(){return Number(this.value);}});
  return nodes.get(key);
 };
 const auth={currentUser:{uid:'d'}};
 for(const id of ['job-1','job-2'])data.set('rides/'+id,{driverId:'d',riderId:'r',riderName:'Rider',status:'completed',pickup:'LGA',dropoff:id==='job-1'?'JFK':'Hartford',fare:100,totalFare:100});
 const context=vm.createContext({URLSearchParams,location:{search},auth,db:{},Intl,Date,Map,Number,JSON,
  document:{createElement:type=>type==='section'?el('panel'):{style:{},children:[],append(...items){this.children.push(...items);}},querySelector:()=>el('main')},
  doc:(_db,...path)=>path.join('/'),getDoc:async()=>({exists:()=>true,data:()=>({role:'driver'})}),
  collection:(_db,...path)=>({path:path.join('/')}),query:ref=>({...ref,type:'query'}),where:(...args)=>args,
  onAuthStateChanged:(_auth,fn)=>login=fn,onSnapshot:(ref,callback,error)=>{listeners.push({ref,callback,error});return()=>{};},
  serverTimestamp:()=> 'now',crypto:{randomUUID:()=> 'event-'+(++nextId)},tollUpdate,tollAmount,riderTotal,
  runTransaction:async(_db,callback)=>{if(gate)await gate;if(failure)throw failure;
   const result=await callback({get:async ref=>({exists:()=>data.has(ref),data:()=>data.get(ref)}),set:(ref,value)=>data.set(ref,value),update:(ref,value)=>data.set(ref,{...data.get(ref),...value})});
   if(loseResponse){loseResponse=false;throw Error('Response lost');}return result;
  }
 });
 vm.runInContext(fs.readFileSync('driver-tolls.js','utf8').replace(/^import[^\n]*\n/gm,''),context);
 const snapshot=(ids=['job-1','job-2'])=>listeners.find(item=>item.ref.type==='query').callback({docs:ids.map(id=>({id,data:()=>data.get('rides/'+id)}))});
 const choose=id=>{el('#tollRide').value=id;el('#tollRide').handlers.change();};
 const fill=(amount=20,road='Bridge')=>{el('#tollCharge').value=String(amount);el('#tollRoad').value=road;el('#tollCustomerAgreed').checked=true;};
 const submit=()=>el('form').onsubmit({preventDefault(){}});
 return {el,data,listeners,login:()=>login(auth.currentUser),snapshot,choose,fill,submit,fail:error=>failure=error,pause:promise=>gate=promise,loseResponse:()=>loseResponse=true};
}
test('latest job is selected by default; receipt deep link selects the requested job',async()=>{
 const h=harness();await h.login();h.snapshot();assert.equal(h.el('#tollRide').value,'job-1');assert.equal(h.el('button').disabled,false);
 const linked=harness('?tollRide=job-2');await linked.login();linked.snapshot();assert.equal(linked.el('#tollRide').value,'job-2');assert.match(linked.el('#tollSelectedJob').textContent,/Hartford/);
});
test('two tolls are saved only to the selected job',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill(20,'First bridge');await h.submit();
 h.el('#addAnotherToll').onclick();h.fill(7.5,'Second bridge');await h.submit();
 assert.equal(h.data.get('rides/job-2').tollsAmount,27.5);assert.equal(h.data.get('rides/job-1').tollsAmount,undefined);
 assert.equal([...h.data.keys()].filter(key=>key.includes('/tollEvents/')).length,2);
 assert.match(h.el('#tollSaveStatus').textContent,/SAVED.*7.50/);assert.match(h.el('#tollSaveStatus').textContent,/Job ID: job-2/);
});
test('live job reorder preserves selection and does not erase the save confirmation',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();await h.submit();const message=h.el('#tollSaveStatus').textContent;
 h.snapshot(['job-2','job-1']);assert.equal(h.el('#tollRide').value,'job-2');assert.equal(h.el('#tollSaveStatus').textContent,message);
});
test('job stays locked while saving and write uses captured job ID',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();let release;h.pause(new Promise(r=>release=r));const saving=h.submit();
 assert.equal(h.el('#tollRide').disabled,true);h.snapshot(['job-2','job-1']);assert.equal(h.el('#tollRide').disabled,true);
 release();await saving;assert.equal(h.data.get('rides/job-2').tollsAmount,20);assert.equal(h.data.get('rides/job-1').tollsAmount,undefined);
});
test('denied writes retain entry and visible job-specific failure after live update',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();h.fail({code:'permission-denied'});await h.submit();
 assert.match(h.el('#tollSaveStatus').textContent,/NOT SAVED for job job-2/);assert.equal(h.el('#tollCharge').value,'20');
 h.snapshot();assert.match(h.el('#tollSaveStatus').textContent,/NOT SAVED/);assert.equal(h.data.get('rides/job-2').tollsAmount,undefined);
});
test('retry after lost response does not duplicate a committed toll',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();h.loseResponse();await h.submit();assert.match(h.el('#tollSaveStatus').textContent,/SAVE NOT CONFIRMED/);await h.submit();
 assert.equal(h.data.get('rides/job-2').tollsAmount,20);assert.equal([...h.data.keys()].filter(key=>key.includes('/tollEvents/')).length,1);
});
test('removed job does not silently switch to another job',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();h.snapshot(['job-1']);
 assert.equal(h.el('#tollRide').value,'');assert.equal(h.el('#tollCustomerAgreed').checked,false);assert.equal(h.el('button').disabled,true);
});
test('assignment change prevents toll being saved to a different rider',async()=>{
 const h=harness();await h.login();h.snapshot();h.choose('job-2');h.fill();h.data.set('rides/job-2',{...h.data.get('rides/job-2'),riderId:'different'});await h.submit();
 assert.match(h.el('#tollSaveStatus').textContent,/assignment changed/);assert.equal(h.data.get('rides/job-2').tollsAmount,undefined);
});

test('active job takes priority over a recently completed job',async()=>{
 const h=harness();await h.login();h.data.set('rides/job-1',{...h.data.get('rides/job-1'),completedAt:'2026-11-06T12:00:00Z'});
 h.data.set('rides/job-2',{...h.data.get('rides/job-2'),status:'started',acceptedAt:'2026-11-06T10:00:00Z'});h.snapshot();
 assert.equal(h.el('#tollRide').value,'job-2');
});
test('most recently completed job defaults when there is no active job',async()=>{
 const h=harness();await h.login();for(const [id,time]of [['job-1','2026-11-06T10:00:00Z'],['job-2','2026-11-06T12:00:00Z']])h.data.set('rides/'+id,{...h.data.get('rides/'+id),completedAt:time});
 h.snapshot();assert.equal(h.el('#tollRide').value,'job-2');
});
test('new accepted job defaults before starting but toll inputs stay disabled',async()=>{
 const h=harness();await h.login();h.snapshot();h.data.set('rides/job-2',{...h.data.get('rides/job-2'),status:'accepted',acceptedAt:'2026-11-06T12:00:00Z'});h.snapshot();
 assert.equal(h.el('#tollRide').value,'job-2');assert.equal(h.el('button').disabled,true);assert.equal(h.el('#tollRoad').disabled,true);
 h.data.set('rides/job-2',{...h.data.get('rides/job-2'),status:'started'});h.snapshot();assert.equal(h.el('button').disabled,false);
});
test('new job does not redirect an entered toll or explicit job choice',async()=>{
 const h=harness();await h.login();h.snapshot();h.fill();h.data.set('rides/job-2',{...h.data.get('rides/job-2'),status:'started'});h.snapshot();
 assert.equal(h.el('#tollRide').value,'job-1');assert.equal(h.el('#tollCharge').value,'20');
 const manual=harness();await manual.login();manual.snapshot();manual.choose('job-1');manual.data.set('rides/job-2',{...manual.data.get('rides/job-2'),status:'started'});manual.snapshot();assert.equal(manual.el('#tollRide').value,'job-1');
});
