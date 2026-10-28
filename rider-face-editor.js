import {auth,db,storage,doc,ref,setDoc,onAuthStateChanged} from './firebase-session.js';
import {getDocFromServer} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {getBlob} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js';
import {liveSnapshot} from './live-firestore.js?v=20261013-live-sync';
import {faceCropRect,riderFaceProfile,ownRiderIdPath,validRiderFace} from './rider-face-data.js';

const panel=document.createElement('section');
panel.className='card';panel.hidden=true;
panel.setAttribute('aria-label','My face photo for the driver');
panel.innerHTML=`<h2>My face photo for the driver</h2>
<p>Your assigned driver can see only your confirmed face crop during an active job. Your license or ID document stays private.</p>
<img data-saved-face alt="Your saved face-only photo" hidden style="width:160px;height:160px;object-fit:cover;border-radius:12px">
<details data-editor><summary>Set up or change my face photo</summary>
<p>Open your saved license or ID, or choose an image or PDF of the same document. Position the square over your face and check the zoomed preview.</p>
<button type="button" data-load-id>Open my saved license / ID</button>
<label style="display:block;margin-top:12px">Or choose a copy of my license / ID
<input data-id-file type="file" accept="image/*,application/pdf"></label>
<div data-crop-area hidden>
<p>Drag the square to your face, or use the position sliders. Keep ID text and document edges outside the square.</p>
<canvas data-id-canvas role="img" aria-label="Your private ID image with a face crop selection" style="display:block;max-width:100%;height:auto;touch-action:none;border:1px solid #aaa"></canvas>
<label style="display:block">Horizontal position <input data-x type="range" min="0" max="100" value="50" style="width:100%"></label>
<label style="display:block">Vertical position <input data-y type="range" min="0" max="100" value="50" style="width:100%"></label>
<label style="display:block">Crop size <input data-size type="range" min="5" max="70" value="30" style="width:100%"></label>
<h3>Face-only preview</h3>
<canvas data-face-canvas width="480" height="480" role="img" aria-label="Zoomed face crop that the driver will see" style="display:block;width:200px;max-width:100%;height:auto;border:1px solid #aaa"></canvas>
<label style="display:block;margin:12px 0"><input data-confirm type="checkbox" style="width:auto"> I confirm the preview shows only my face, without my ID number, name, address or document edges.</label>
<button type="button" data-save-face>Save face-only photo</button>
</div></details><p data-message role="status" aria-live="polite"></p>`;
const host=document.getElementById('rideForm');
if(host)host.after(panel);else document.querySelector('main')?.append(panel);
const el=selector=>panel.querySelector(selector);
const canvas=el('[data-id-canvas]'),preview=el('[data-face-canvas]');
const source=document.createElement('canvas');
let uid=null,epoch=0,sourceEpoch=0,stop=null,pdf=null,dragging=false;
function message(text){el('[data-message]').textContent=text;}
function clearDocument(){
  sourceEpoch++;pdf?.destroy?.();pdf=null;
  source.width=source.height=canvas.width=canvas.height=0;
  preview.getContext('2d').clearRect(0,0,preview.width,preview.height);
  el('[data-crop-area]').hidden=true;el('[data-confirm]').checked=false;el('[data-id-file]').value='';
}
function reset(){stop?.();stop=null;uid=null;panel.hidden=true;clearDocument();el('[data-saved-face]').removeAttribute('src');el('[data-saved-face]').hidden=true;message('');}
function current(check,expected){return epoch===check && uid===expected && auth.currentUser?.uid===expected;}
function draw(){
  if(!source.width)return;
  const crop=faceCropRect(source.width,source.height,Number(el('[data-x]').value)/100,Number(el('[data-y]').value)/100,Number(el('[data-size]').value)/100);
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0);
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);ctx.rect(crop.x,crop.y,crop.width,crop.height);ctx.fill('evenodd');
  ctx.strokeStyle='#1462db';ctx.lineWidth=Math.max(2,source.width/250);ctx.strokeRect(crop.x,crop.y,crop.width,crop.height);
  const face=preview.getContext('2d');face.fillStyle='#fff';face.fillRect(0,0,480,480);face.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,480,480);
  el('[data-confirm]').checked=false;
}
async function loadDocument(blob,name=''){
  const check=epoch,expected=uid;
  if(!expected)return;
  clearDocument();
  const attempt=++sourceEpoch;
  if(blob.size<=0||blob.size>=10*1024*1024)throw new Error('Choose an ID image or PDF smaller than 10 MB.');
  const isPdf=blob.type==='application/pdf'||/\.pdf$/i.test(name);
  if(!isPdf&&!blob.type.startsWith('image/'))throw new Error('Choose an image or PDF of your license or ID.');
  message('Opening your private ID on this device…');
  let image=null,localUrl=null;
  try{
    if(isPdf){
      const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const loaded=await pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise;
      if(!current(check,expected)||attempt!==sourceEpoch){loaded.destroy();return;}
      pdf?.destroy?.();pdf=loaded;
      const page=await loaded.getPage(1),initial=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(2,1400/Math.max(initial.width,initial.height))});
      image=document.createElement('canvas');image.width=Math.ceil(viewport.width);image.height=Math.ceil(viewport.height);
      await page.render({canvasContext:image.getContext('2d'),viewport}).promise;
    }else{
      image=new Image();localUrl=URL.createObjectURL(blob);image.src=localUrl;await image.decode();
    }
    if(!current(check,expected)||attempt!==sourceEpoch)return;
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    if(!width||!height)throw new Error('This ID image could not be read.');
    const scale=Math.min(1,1200/Math.max(width,height));
    source.width=canvas.width=Math.round(width*scale);source.height=canvas.height=Math.round(height*scale);
    source.getContext('2d').drawImage(image,0,0,source.width,source.height);
    for(const selector of ['[data-x]','[data-y]'])el(selector).value='50';el('[data-size]').value='30';
    el('[data-crop-area]').hidden=false;el('[data-editor]').open=true;draw();
    message(isPdf?'Showing the first PDF page. Move the square over your face. If your face is on another page, choose an image of that page.':'Move the square over your face, then confirm the preview.');
    const initialSelection=['[data-x]','[data-y]','[data-size]'].map(selector=>el(selector).value).join(':');
    if(typeof window.FaceDetector==='function'){
      try{
        const faces=await new window.FaceDetector({fastMode:false,maxDetectedFaces:3}).detect(source);
        if(!current(check,expected)||attempt!==sourceEpoch||el('[data-confirm]').checked
          || ['[data-x]','[data-y]','[data-size]'].map(selector=>el(selector).value).join(':')!==initialSelection)return;
        const found=faces.sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)[0]?.boundingBox;
        if(found){el('[data-x]').value=String((found.x+found.width/2)/source.width*100);el('[data-y]').value=String((found.y+found.height/2)/source.height*100);el('[data-size]').value=String(Math.min(70,Math.max(5,Math.max(found.width,found.height)*1.15/Math.min(source.width,source.height)*100)));draw();}
      }catch{}
    }
  }finally{if(localUrl)URL.revokeObjectURL(localUrl);}
}
function errorMessage(error){return String(error?.code||'').includes('permission-denied')||String(error?.code||'').includes('unauthorized')
  ? 'Face-photo setup is blocked by account permissions. Contact the administrator to publish the rider face rules.'
  : (error?.message||'Unable to prepare your face photo. Try again.');}
for(const selector of ['[data-x]','[data-y]','[data-size]'])el(selector).addEventListener('input',draw);
function move(event){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;el('[data-x]').value=String((event.clientX-rect.left)/rect.width*100);el('[data-y]').value=String((event.clientY-rect.top)/rect.height*100);draw();}
canvas.addEventListener('pointerdown',event=>{dragging=true;canvas.setPointerCapture?.(event.pointerId);move(event);});
canvas.addEventListener('pointermove',event=>{if(dragging)move(event);});
for(const name of ['pointerup','pointercancel'])canvas.addEventListener(name,()=>{dragging=false;});
el('[data-id-file]').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{await loadDocument(file,file.name);}catch(error){message(errorMessage(error));}});
el('[data-load-id]').onclick=async()=>{
  const check=epoch,expected=uid;if(!expected)return;
  const button=el('[data-load-id]');button.disabled=true;message('Loading your saved license / ID…');
  try{
    const application=await getDocFromServer(doc(db,'riderApplications','rider_'+expected));
    if(!current(check,expected))return;
    const data=application.exists()?application.data():null,path=ownRiderIdPath(expected,data);
    if(!path)throw new Error('Your saved ID could not be found. Choose a copy of your license or ID above.');
    const blob=await getBlob(ref(storage,path),10*1024*1024);
    if(current(check,expected))await loadDocument(blob,data.documents.driverLicense.originalName||path);
  }catch(error){if(current(check,expected))message('Your saved ID could not be opened. Choose an image or PDF of the same ID above.');}
  finally{button.disabled=false;}
};
el('[data-save-face]').onclick=async()=>{
  const check=epoch,expected=uid;if(!expected||!source.width)return;
  if(!el('[data-confirm]').checked){message('Check that the preview shows only your face, then confirm it before saving.');return;}
  const button=el('[data-save-face]');button.disabled=true;
  try{
    let image='';for(const quality of [.9,.75,.6,.45]){image=preview.toDataURL('image/jpeg',quality);if(validRiderFace(image))break;}
    const profile=riderFaceProfile(expected,image,true);
    if(!current(check,expected))return;
    await setDoc(doc(db,'riderFaceProfiles',expected),profile);
    if(!current(check,expected))return;
    el('[data-saved-face]').src=image;el('[data-saved-face]').hidden=false;clearDocument();el('[data-editor]').open=false;
    message('Face-only photo saved. It will be shared with your assigned driver during an active job.');
  }catch(error){if(current(check,expected))message(errorMessage(error));}
  finally{button.disabled=false;}
};
async function watch(user){
  const check=++epoch;reset();if(!user)return;uid=user.uid;const expected=uid;
  try{
    const snapshot=await getDocFromServer(doc(db,'users',expected));
    if(!current(check,expected)||!snapshot.exists()||snapshot.data().role!=='rider')return;
    panel.hidden=false;
    stop=liveSnapshot(doc(db,'riderFaceProfiles',expected),snapshot=>{
      if(!current(check,expected))return;
      const face=snapshot.exists()?snapshot.data():null;
      if(face?.uid===expected&&validRiderFace(face.image)){el('[data-saved-face]').src=face.image;el('[data-saved-face]').hidden=false;}
      else{el('[data-saved-face]').removeAttribute('src');el('[data-saved-face]').hidden=true;el('[data-editor]').open=true;}
    },error=>{if(current(check,expected))message(errorMessage(error));});
  }catch(error){if(current(check,expected)){panel.hidden=false;message(errorMessage(error));}}
}
onAuthStateChanged(auth,watch);
window.addEventListener('pagehide',()=>{epoch++;reset();});
window.addEventListener('pageshow',event=>{if(event.persisted)watch(auth.currentUser);});
