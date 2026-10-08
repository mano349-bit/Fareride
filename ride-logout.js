import {auth,signOut,onAuthStateChanged} from './firebase-config.js';
const role=location.pathname.endsWith('/driver.html')?'driver':'rider';
const header=document.querySelector('header');
const button=document.createElement('button');button.type='button';button.textContent='Log out';button.hidden=true;
button.style.cssText='padding:10px 16px;margin-left:16px;background:#0875e1;color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer';
const message=document.createElement('span');message.setAttribute('role','status');message.style.cssText='margin-left:12px;color:#b42318';
header.append(button,message);
onAuthStateChanged(auth,user=>{button.hidden=!user;});
button.onclick=async()=>{
 button.disabled=true;message.textContent='';
 try{await signOut(auth);location.replace(role+'-login.html');}
 catch{message.textContent='Unable to log out. Please retry.';button.disabled=false;}
};
