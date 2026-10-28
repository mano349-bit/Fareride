import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {tollUpdate,tollAmount} from './toll-accounting.js';
function harness(search=''){
 const nodes=new Map(),listeners=[],data=new Map();let login,nextId=0;
 function element(key){
  if(!nodes.has(key)){const node={children:[],value:'',hidden:false,disabled:false,checked:false,textContent:'',handlers:{},
   append(...children){this.children.push(...children);if(key==='#tollRide'&&!this.value&&children[0])this.value=children[0].value;},
   replaceChildren(...children){this.children=children;if(key==='#tollRide')this.value=children[0]?.value||'';},
   querySelector:element,setAttribute(name,value){this[name]=value;},addEventListener(type,fn){this.handlers[type]=fn;},focus(){this.focused=true;},reportValidity(){return true;},
   get options(){return this.children;},get valueAsNumber(){return Number(this.value);}};
   nodes.set(key,node);
  }return nodes.get(key);
 }
 const auth={currentUser:{uid:'driver'}};
 data.set('rides/ride-1',{driverId:'driver',riderId:'rider',riderName:'Rider',status:'completed',fare:100,totalFare:100});
 const context=vm.createContext({URLSearchParams,location:{search},auth,db:{},document:{createElement:type=>type==='section'?element('panel'):({children:[],append(...items){this.children.push(...items);}}),querySelector:()=>element('main')},
  doc:(_db,...path)=>path.join('/'),getDoc:async()=>({exists:()=>true,data:()=>({role:'driver'})}),
  collection:(_db,...path)=>({type:'collection',path:path.join('/')}),where:(...args)=>args,query:ref=>({...ref,type:'query'}),
  onAuthStateChanged:(_auth,fn)=>login=fn,onSnapshot:(ref,callback)=>{listeners.push({ref,callback});return()=>{};},
  serverTimestamp:()=> 'timestamp',crypto:{randomUUID:()=> 'event-'+(++nextId)},tollUpdate,tollAmount,
  runTransaction:async(_db,callback)=>callback({get:async ref=>({exists:()=>data.has(ref),data:()=>data.get(ref)}),set:(ref,value)=>data.set(ref,value),update:(ref,value)=>data.set(ref,{...data.get(ref),...value})})
 });
 const code=fs.readFileSync('driver-tolls.js','utf8').replace(/^import[^\n]*\n/gm,'');vm.runInContext(code,context);
 return {nodes,data,listeners,auth,login:()=>login(auth.currentUser),element};
}
test('toll controls load and support two separate tolls on the same ride',async()=>{
 const h=harness();assert.equal(h.element('main').children.length,1);await h.login();
 h.listeners[0].callback({docs:[{id:'ride-1',data:()=>h.data.get('rides/ride-1')}]});
 assert.equal(h.element('form').hidden,false);assert.equal(h.element('#tollRide').value,'ride-1');
 async function add(amount,location){h.element('#tollRoad').value=location;h.element('#tollCharge').value=String(amount);h.element('#tollCustomerAgreed').checked=true;await h.element('form').onsubmit({preventDefault(){}});}
 await add(20,'Verrazzano Bridge');assert.equal(h.data.get('rides/ride-1').tollsAmount,20);
 h.element('#addAnotherToll').onclick();assert.equal(h.element('#tollRide').value,'ride-1');assert.equal(h.element('#tollCustomerAgreed').checked,false);
 await add(7.5,'Second toll');assert.equal(h.data.get('rides/ride-1').tollsAmount,27.5);
 const records=[...h.data].filter(([key])=>key.includes('/tollEvents/'));
 assert.equal(records.length,2);
 const listener=h.listeners.find(item=>item.ref.path==='rides/ride-1/tollEvents');
 listener.callback({docs:records.map(([id,value])=>({id,data:()=>value}))});
 assert.equal(h.element('#recordedRideTolls').children[1].children.length,2);
 assert.equal(h.element('#recordedRideTolls').children[1].children[0].textContent,'Verrazzano Bridge — $20.00');
 h.auth.currentUser=null;await h.login();assert.equal(h.element('form').hidden,true);
});

test('agreement validation uses a larger accessible notice and hides it after checking',()=>{
 const h=harness(),checkbox=h.element('#tollCustomerAgreed'),notice=h.element('#tollAgreementNotice');let prevented=false;
 assert.equal(notice.hidden,true);
 checkbox.handlers.invalid({preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(notice.hidden,false);assert.equal(checkbox.focused,true);
 checkbox.checked=true;checkbox.handlers.change();assert.equal(notice.hidden,true);
});

test('receipt link selects the matching ride instead of the first ride',async()=>{
 const h=harness('?tollRide=ride-1');await h.login();
 h.listeners[0].callback({docs:[{id:'other',data:()=>({driverId:'driver',riderId:'rider',status:'completed',completedAt:'2026-10-28'})},{id:'ride-1',data:()=>h.data.get('rides/ride-1')}]});
 assert.equal(h.element('#tollRide').value,'ride-1');
});
