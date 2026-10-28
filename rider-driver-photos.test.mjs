import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {canShowDriverPhotos,validDriverPhoto} from './driver-photos.js';
function harness(){
 const nodes=new Map(),events=new Map(),images=[{},{}];let resolve,login;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',setAttribute(){},append(){},removeAttribute(key){delete this[key];}});return nodes.get(id);};
 for(const image of images)image.removeAttribute=key=>delete image[key];
 const panel=node('panel');panel.querySelector=node;panel.querySelectorAll=()=>images;
 const auth={currentUser:{uid:'r'}};
 const context=vm.createContext({auth,db:{},doc:(_,c,id)=>id,canShowDriverPhotos,validDriverPhoto,document:{createElement:()=>panel,getElementById:()=>node('host')},window:{addEventListener:(event,cb)=>events.set(event,cb)},onAuthStateChanged:(_,cb)=>login=cb,liveSnapshot:(_,callback)=>{resolve=callback;return ()=>{};}});
 vm.runInContext(fs.readFileSync('rider-driver-photos.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
 const ride={id:'job',riderId:'r',driverId:'d',status:'accepted'};
 return {panel,images,auth,node,login:()=>login(),show:data=>events.get('fareride-ride-restored')({detail:{...ride,...data}}),finish:()=>resolve({exists:()=>true,data:()=>({driverId:'d',portrait:'data:image/jpeg;base64,YQ==',vehicle:'data:image/jpeg;base64,Yg==',plateNumber:'ABC123'})})};
}
test('live photos and plate are cleared immediately when a trip ends',async()=>{
 const h=harness();h.show();h.finish();await new Promise(r=>setImmediate(r));
 assert.equal(h.panel.hidden,false);assert.ok(h.images[0].src);assert.match(h.node('[data-plate]').textContent,/ABC123/);
 h.show({status:'completed'});assert.equal(h.panel.hidden,true);assert.equal(h.images[0].src,undefined);assert.equal(h.node('[data-plate]').textContent,'');
});
test('late photo responses cannot restore photos after cancellation or logout',async()=>{
 for(const end of ['cancelled','logout']){
  const h=harness();h.show();if(end==='logout'){h.auth.currentUser=null;h.login();}else h.show({status:end});
  h.finish();await new Promise(r=>setImmediate(r));assert.equal(h.panel.hidden,true);assert.equal(h.images[0].src,undefined);
 }
});

test('photos appear automatically when the driver shares them after assignment',()=>{
 const h=harness();h.show();h.finish();assert.equal(h.images[0].src,'data:image/jpeg;base64,Yg==');assert.equal(h.images[1].src,'data:image/jpeg;base64,YQ==');
});
