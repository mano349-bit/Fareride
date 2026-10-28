import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {faceCropRect,riderFaceProfile,ownRiderIdPath,validRiderFace} from './rider-face-data.js';

const face = 'data:image/jpeg;base64,YQ==';
const original = {name:'private-id-number-12345.png',type:'image/png',size:500,privateDocumentText:'ID number, name, address'};
function harness({application,decodeImage,profileLookup,detectFaces} = {}) {
  const nodes=new Map(),events=new Map(),images=[],draws=[],encoded=[],saved=[],blobReads=[],reads=[],subscriptions=[],revoked=[];
  let login,source;
  const context2d = label => ({
    drawImage:(...args)=>draws.push({canvas:label,args}),
    clearRect(){},fillRect(){},beginPath(){},rect(){},fill(){},strokeRect(){}
  });
  const node = key => {
    if(!nodes.has(key)){
      const context=context2d(key),listeners=new Map();
      nodes.set(key,{hidden:true,textContent:'',value:'',checked:false,disabled:false,open:false,width:480,height:480,style:{},listeners,
        addEventListener:(name,callback)=>listeners.set(name,callback),
        setAttribute(){},removeAttribute(name){delete this[name];},
        getContext:()=>context,
        getBoundingClientRect:()=>({left:0,top:0,width:1200,height:600}),
        toDataURL:(mime,quality)=>{encoded.push({canvas:key,mime,quality});if(key!=='[data-face-canvas]')throw Error('Original ID must never be encoded');return face;}
      });
    }
    return nodes.get(key);
  };
  const panel=node('panel');panel.querySelector=node;
  const auth={currentUser:{uid:'r'}};
  const context=vm.createContext({
    auth,db:{},storage:{},faceCropRect,riderFaceProfile,ownRiderIdPath,validRiderFace,
    document:{
      createElement:tag=>{if(tag==='section')return panel;if(tag==='canvas'){source=node('private-source');return source;}throw Error('Unexpected element '+tag);},
      getElementById:()=>({after(){}}),querySelector:()=>({append(){}})
    },
    window:{addEventListener:(name,callback)=>events.set(name,callback), ...(detectFaces?{FaceDetector:class {detect(){return detectFaces();}}}:{})},
    URL:{createObjectURL:()=> 'blob:private-source-only',revokeObjectURL:url=>revoked.push(url)},
    Image:class{constructor(){this.naturalWidth=1800;this.naturalHeight=900;images.push(this);}decode(){return decodeImage?decodeImage(images.length):Promise.resolve();}},
    onAuthStateChanged:(_,callback)=>login=callback,
    doc:(_,collection,id)=>({collection,id}),ref:(_,path)=>({path}),
    getDocFromServer:async reference=>{
      reads.push(reference);
      if(profileLookup&&reference.collection==='users')return profileLookup(reference);
      const value=reference.collection==='users'?{role:'rider'}:reference.collection==='riderApplications'?application:null;
      return {exists:()=>Boolean(value),data:()=>value};
    },
    getBlob:async reference=>{blobReads.push(reference);return original;},
    setDoc:async(reference,value)=>{saved.push({reference,value:JSON.parse(JSON.stringify(value))});},
    liveSnapshot:(reference,next,error)=>{const sub={reference,next,error,stopped:false};subscriptions.push(sub);return ()=>{sub.stopped=true;};}
  });
  vm.runInContext(fs.readFileSync('rider-face-editor.js','utf8').replace(/^import[^\n]+\n/gm,''),context);
  return {panel,node,auth,images,draws,encoded,saved,blobReads,reads,subscriptions,revoked,source:()=>source,events,
    login:async user=>{auth.currentUser=user;return login(user);},
    file:async(file=original)=>node('[data-id-file]').listeners.get('change')({target:{files:[file]}}),
    click:key=>node(key).onclick(),
    input:key=>node(key).listeners.get('input')()
  };
}

test('saving requires manual confirmation and encodes only the face preview',async()=>{
  const h=harness();await h.login({uid:'r'});await h.file();
  await h.click('[data-save-face]');assert.equal(h.saved.length,0);assert.equal(h.encoded.length,0);
  assert.match(h.node('[data-message]').textContent,/confirm/);
  h.node('[data-confirm]').checked=true;await h.click('[data-save-face]');
  assert.equal(h.saved.length,1);assert.deepEqual(h.saved[0].reference,{collection:'riderFaceProfiles',id:'r'});
  const value=h.saved[0].value;assert.deepEqual(Object.keys(value).sort(),['image','uid','updatedAt']);
  assert.equal(value.uid,'r');assert.equal(value.image,face);assert.ok(Number.isFinite(Date.parse(value.updatedAt)));
  assert.ok(h.encoded.every(call=>call.canvas==='[data-face-canvas]'&&call.mime==='image/jpeg'));
  assert.equal(JSON.stringify(value).includes(original.name),false);assert.equal(JSON.stringify(value).includes(original.privateDocumentText),false);
  assert.equal(h.source().width,0);assert.equal(h.node('[data-crop-area]').hidden,true);
});

test('the source is downscaled, then a bounded square crop is drawn into the zoomed preview',async()=>{
  const h=harness();await h.login({uid:'r'});await h.file();
  assert.equal(h.source().width,1200);assert.equal(h.source().height,600);
  const downscale=h.draws.find(call=>call.canvas==='private-source');
  assert.equal(downscale.args[0],h.images[0]);assert.deepEqual(downscale.args.slice(1),[0,0,1200,600]);
  const crop=h.draws.filter(call=>call.canvas==='[data-face-canvas]').at(-1);
  assert.equal(crop.args[0],h.source());assert.deepEqual(crop.args.slice(1),[510,210,180,180,0,0,480,480]);
  h.node('[data-confirm]').checked=true;h.node('[data-x]').value='0';h.node('[data-y]').value='100';h.node('[data-size]').value='70';h.input('[data-size]');
  const edge=h.draws.filter(call=>call.canvas==='[data-face-canvas]').at(-1);
  assert.deepEqual(edge.args.slice(1),[0,180,420,420,0,0,480,480]);assert.equal(h.node('[data-confirm]').checked,false);
});

test('saved-ID loading fetches only this rider application and an owned ID path',async()=>{
  const path='riderApplications/rider_r/driver-license-123-id.png';
  const h=harness({application:{documents:{driverLicense:{path,originalName:'id.png'}}}});
  await h.login({uid:'r'});await h.click('[data-load-id]');
  assert.deepEqual(h.reads,[{collection:'users',id:'r'},{collection:'riderApplications',id:'rider_r'}]);
  assert.deepEqual(h.blobReads,[{path}]);assert.equal(h.node('[data-crop-area]').hidden,false);
  for(const badPath of ['riderApplications/rider_other/driver-license-123-id.png','driverApplications/driver_r/license.png','riderApplications/rider_r/nested/id.png']){
    const bad=harness({application:{documents:{driverLicense:{path:badPath}}}});
    await bad.login({uid:'r'});await bad.click('[data-load-id]');assert.equal(bad.blobReads.length,0);assert.equal(bad.saved.length,0);
  }
});

test('logout clears the private document and a late image decode cannot restore it',async()=>{
  let finishDecode;
  const h=harness({decodeImage:()=>new Promise(resolve=>finishDecode=resolve)});
  await h.login({uid:'r'});const loading=h.file();
  assert.equal(h.images.length,1);await h.login(null);
  finishDecode();await loading;
  assert.equal(h.panel.hidden,true);assert.equal(h.source().width,0);assert.equal(h.node('[data-crop-area]').hidden,true);
  assert.equal(h.node('[data-saved-face]').src,undefined);assert.equal(h.saved.length,0);
  assert.deepEqual(h.revoked,['blob:private-source-only']);
});

test('auth switching and pagehide remove the ID source and prevent stale profile portraits',async()=>{
  const h=harness();await h.login({uid:'r'});await h.file();const old=h.subscriptions[0];
  await h.login({uid:'other'});
  old.next({exists:()=>true,data:()=>({uid:'r',image:face})});
  assert.equal(h.node('[data-saved-face]').src,undefined);assert.equal(h.source().width,0);
  await h.file();h.events.get('pagehide')();
  assert.equal(h.panel.hidden,true);assert.equal(h.source().width,0);assert.equal(h.node('[data-confirm]').checked,false);
});


test('opening a second ID clears the old confirmation, and the older decode cannot replace it',async()=>{
  let finishFirst;
  const h=harness({decodeImage:count=>count===1?new Promise(resolve=>finishFirst=resolve):Promise.resolve()});
  await h.login({uid:'r'});const first=h.file();await h.file({...original,name:'new-private-id.png'});
  assert.equal(h.draws.filter(call=>call.canvas==='private-source').at(-1).args[0],h.images[1]);
  h.node('[data-confirm]').checked=true;finishFirst();await first;
  assert.equal(h.draws.filter(call=>call.canvas==='private-source').length,1);
  assert.equal(h.draws.filter(call=>call.canvas==='private-source').at(-1).args[0],h.images[1]);
  let finishThird;
  // A separate editor verifies old approval cannot authorize a newly loading source.
  const next=harness({decodeImage:count=>count===2?new Promise(resolve=>finishThird=resolve):Promise.resolve()});
  await next.login({uid:'r'});await next.file();next.node('[data-confirm]').checked=true;
  const loading=next.file({...original,name:'third-private-id.png'});
  assert.equal(next.node('[data-confirm]').checked,false);assert.equal(next.source().width,0);
  await next.click('[data-save-face]');assert.equal(next.saved.length,0);finishThird();await loading;
});

test('late automatic face positioning cannot override a manually adjusted or confirmed crop',async()=>{
  for(const manual of ['position','confirm']){
    let finishDetection;
    const h=harness({detectFaces:()=>new Promise(resolve=>finishDetection=resolve)});
    await h.login({uid:'r'});const loading=h.file();await new Promise(resolve=>setImmediate(resolve));
    if(manual==='position'){h.node('[data-x]').value='20';h.input('[data-x]');}else h.node('[data-confirm]').checked=true;
    const priorDraws=h.draws.filter(call=>call.canvas==='[data-face-canvas]').length;
    finishDetection([{boundingBox:{x:900,y:100,width:150,height:150}}]);await loading;
    assert.equal(h.draws.filter(call=>call.canvas==='[data-face-canvas]').length,priorDraws);
    assert.equal(h.node('[data-x]').value,manual==='position'?'20':'50');
    assert.equal(h.node('[data-confirm]').checked,manual==='confirm');
  }
});
