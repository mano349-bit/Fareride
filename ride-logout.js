import {prepareDriverSignOut,resumeDriverSession} from './driver-availability.js?v=20261026-auto-online';
import {auth,signOut,onAuthStateChanged} from './firebase-session.js';
const role=location.pathname.split('/').pop().toLowerCase().startsWith('driver')?'driver':'rider';
const header=document.querySelector('header');
const button=document.createElement('button');button.type='button';button.textContent='Log out';button.hidden=true;
button.style.cssText='padding:10px 16px;margin-left:16px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer';
const message=document.createElement('span');message.setAttribute('role','status');message.style.cssText='margin-left:12px;color:#b42318';
header.append(button,message);
onAuthStateChanged(auth,user=>{button.hidden=!user;});
button.onclick=async()=>{
 button.disabled=true;message.textContent='';
 try{
  if(role==='driver'){
   const cleanup=prepareDriverSignOut();
   if(cleanup){let timer;try{await Promise.race([cleanup,new Promise(resolve=>{timer=setTimeout(resolve,3000);})]);}catch{}finally{clearTimeout(timer);}}
  }
  await signOut(auth);location.replace(role+'-login.html');
 }
 catch{if(role==='driver')resumeDriverSession();message.textContent='Unable to log out. Please retry.';button.disabled=false;}
};
