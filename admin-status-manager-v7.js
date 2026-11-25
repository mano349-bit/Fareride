import {adminRecords, mountAdminCalendar, onAdminCalendar} from './admin-calendar.js';
import { db } from "./firebase-session.js";
import { observeAdmin } from './admin-session.js';
import { collection, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const C={driver:"driverApplications",rider:"riderApplications"};
const S={driver:[],rider:[]};
const G={
 new:{label:"New Applicants",m:s=>!["approved","active","suspended","deleted"].includes(s)},
 approved:{label:"Approved",m:s=>["approved","active"].includes(s)},
 suspended:{label:"Suspended",m:s=>s==="suspended"},
 deleted:{label:"Deleted",m:s=>s==="deleted"}
};
const status=x=>String(x.status||x.accountStatus||"new").toLowerCase();
const name=x=>x.fullName||x.name||x.email||String(x.id||"").slice(-4);
const ids=(r,g)=>[...document.querySelectorAll(`.fr7-c[data-role="${r}"][data-group="${g}"]:checked`)].map(x=>x.dataset.id);

async function move(r,id,next){
 const x=S[r].find(a=>a.id===id); if(!x) throw new Error("Applicant not found");
 const now=new Date().toISOString();
 const f={status:next,accountStatus:next,updatedAt:now};
 if(next==="approved"){f.approvedAt=now;f.suspendedAt=null;f.deletedAt=null}
 if(next==="suspended")f.suspendedAt=now;
 if(next==="deleted")f.deletedAt=now;
 await setDoc(doc(db,C[r],id),f,{merge:true});
 if(x.uid) await setDoc(doc(db,"users",x.uid),{approved:next==="approved",status:next,accountStatus:next,updatedAt:now},{merge:true});
}
async function bulk(r,g,next){
 const a=ids(r,g); if(!a.length){alert("Select at least one applicant first.");return}
 const w=next==="approved"?"APPROVE / ACTIVATE":next==="suspended"?"SUSPEND":"MOVE TO DELETED";
 if(!confirm(`${w} ${a.length} selected applicant(s)?`))return;
 try{for(const id of a)await move(r,id,next)}catch(e){console.error(e);alert("Action failed. Check F12 Console.")}
}
function btn(t,c,f){const b=document.createElement("button");b.type="button";b.textContent=t;b.className=`fr7-a ${c}`;b.onclick=f;return b}
const calendarCleanups=[];
const selectedGroups={driver:"new",rider:"new"};
const calendarKey=(r,g)=>g==='new'?(r==='driver'?'newApplicants':'riderApplicants'):g==='approved'?(r==='driver'?'approvedDrivers':'approvedRiders'):g==='suspended'?'suspendedDrivers':r+'Deleted';
function group(r,g){
 const a=adminRecords(S[r],calendarKey(r,g),g).filter(x=>G[g].m(status(x))),p=document.createElement("section");p.className="fr7-g";
 const h=document.createElement("h3");h.textContent=`${G[g].label} (${a.length})`;p.append(h);calendarCleanups.push(mountAdminCalendar(p,calendarKey(r,g)));
 if(!a.length){const q=document.createElement("p");q.textContent="No applicants in this section.";p.append(q);return p}
 const t=document.createElement("div");t.className="fr7-tools";
 const lab=document.createElement("label"),all=document.createElement("input");all.type="checkbox";lab.append(all,document.createTextNode(" Select All"));t.append(lab);
 const n=document.createElement("strong");n.textContent="0 selected";t.append(n);
 const count=()=>n.textContent=`${ids(r,g).length} selected`;
 if(["new","suspended","deleted"].includes(g))t.append(btn(g==="new"?"Approve / Activate":"Reapprove","green",()=>bulk(r,g,"approved")));
 if(g!=="suspended")t.append(btn("Suspend","orange",()=>bulk(r,g,"suspended")));
 if(g!=="deleted")t.append(btn("Delete","red",()=>bulk(r,g,"deleted")));
 p.append(t);
 for(const x of a){
   const row=document.createElement("label");row.className="fr7-row";
   const cb=document.createElement("input");cb.type="checkbox";cb.className="fr7-c";cb.dataset.role=r;cb.dataset.group=g;cb.dataset.id=x.id;cb.onchange=count;
   const sp=document.createElement("span");sp.textContent=[name(x)+" (ID: "+String(x.uid||x.id||"").slice(-4)+")",x.email||"",x.phone||x.phoneNumber||"",status(x)].filter(Boolean).join(" — ");
   row.append(cb,sp);p.append(row);
 }
 all.onchange=()=>{p.querySelectorAll(".fr7-c").forEach(x=>x.checked=all.checked);count()};
 return p;
}
function role(r){
 const w=document.createElement("div");w.className="fr7-role";const h=document.createElement("h2");h.textContent=r==="driver"?"Driver Applicant Manager":"Rider Applicant Manager";w.append(h);
 const tabs=document.createElement("div");tabs.className="fr7-tabs";const panes=document.createElement("div");
 ["new","approved","suspended","deleted"].forEach((g,i)=>{
  const b=document.createElement("button");b.type="button";b.textContent=G[g].label;b.className="fr7-tab"+(g===selectedGroups[r]?" active":"");
  const p=group(r,g);p.hidden=g!==selectedGroups[r];
  b.onclick=()=>{selectedGroups[r]=g;tabs.querySelectorAll("button").forEach(x=>x.classList.remove("active"));panes.querySelectorAll(".fr7-g").forEach(x=>x.hidden=true);b.classList.add("active");p.hidden=false};
  tabs.append(b);panes.append(p);
 });w.append(tabs,panes);return w;
}
const ratesPanel = document.getElementById('panel-rates');
const ratesHome = document.getElementById('ratesHome');
function parkRates(){if(ratesPanel && ratesHome){ratesPanel.hidden=true;ratesHome.after(ratesPanel);}}
const adminFrame = document.querySelector('.admin-content-frame');
let activeSection = 'rates';
const mainTabs = [['rates','FareRide Rates Control'],['driver','Driver Applicant Manager'],['rider','Rider Applicant Manager'],['admin','FareRide Admin']];
function activateSection(key){
 if(!mainTabs.some(([id])=>id===key))return;
 activeSection=key;
 const host=document.getElementById('fr7-fixed-host');
 if(!host)return;
 host.querySelectorAll('[data-fr7-section]').forEach(panel=>panel.hidden=panel.dataset.fr7Section!==key);
 host.querySelectorAll('[data-fr7-tab]').forEach(button=>{
  const selected=button.dataset.fr7Tab===key;
  button.classList.toggle('active',selected);
  button.setAttribute('aria-selected',String(selected));
 });
 if(adminFrame)adminFrame.hidden=authorized && key!=='admin';
}
window.addEventListener('fareride-open-rates',()=>activateSection('rates'));
function render(){
 if(!authorized)return;
 const checked=new Set([...document.querySelectorAll('#fr7-fixed-host .fr7-c:checked')].map(cb=>[cb.dataset.role,cb.dataset.group,cb.dataset.id].join('|')));
 calendarCleanups.splice(0).forEach(cleanup=>cleanup());
 let host=document.getElementById("fr7-fixed-host");
 if(!host){
  host=document.createElement("div");host.id="fr7-fixed-host";
  document.body.insertBefore(host,document.body.firstChild);
 }
 // Move the original controls, never clone them or discard their event handlers or draft values.
 parkRates();
 host.replaceChildren();
 const top=document.createElement("div");top.className="fr7-top";top.innerHTML="<h1>FareRide Applicant Management</h1><p>Checkboxes and status tabs stay available even when the older Admin page redraws.</p>";
 const tabs=document.createElement('div');tabs.className='fr7-main-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','FareRide management sections');
 for(const [key,label] of mainTabs){
  const button=document.createElement('button');button.type='button';button.className='fr7-main-tab';button.dataset.fr7Tab=key;button.textContent=label;button.setAttribute('role','tab');button.onclick=()=>activateSection(key);tabs.append(button);
 }
 top.append(tabs);host.append(top);
 if(ratesPanel){ratesPanel.dataset.fr7Section='rates';host.append(ratesPanel);}
 for(const r of ['driver','rider']){
  const panel=role(r);panel.dataset.fr7Section=r;host.append(panel);
 }
 for(const cb of host.querySelectorAll('.fr7-c'))if(checked.has([cb.dataset.role,cb.dataset.group,cb.dataset.id].join('|'))){cb.checked=true;cb.onchange?.();}
 activateSection(activeSection);
}
let timer;
let authorized = false;
onAdminCalendar(()=>{if(authorized)schedule();});
const stops = [];
const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,100)};
observeAdmin(approved => {
 authorized = approved;
 calendarCleanups.splice(0).forEach(cleanup=>cleanup());
 stops.splice(0).forEach(stop => stop());
 clearTimeout(timer);
 S.driver = []; S.rider = [];
 parkRates();
 document.getElementById('fr7-fixed-host')?.remove();
 if(adminFrame)adminFrame.hidden=false;
 activeSection='rates';
 if (!approved) return;
 for(const r of ["driver","rider"])stops.push(onSnapshot(collection(db,C[r]),s=>{S[r]=s.docs.map(d=>({id:d.id,...d.data()}));schedule()},e=>console.error("FareRide manager listener:",r,e)));
 schedule();
});

/* Persistence guard: old admin code may redraw body children. Reattach only if our host is actually removed.
   Do NOT continuously rebuild while users click checkboxes. */
const guard=new MutationObserver(()=>{
 if(authorized && !document.getElementById("fr7-fixed-host")) schedule();
});
guard.observe(document.documentElement,{childList:true,subtree:true});
