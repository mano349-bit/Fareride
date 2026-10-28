import {auth,db,doc,getDoc,onSnapshot,onAuthStateChanged,serverTimestamp} from './firebase-session.js';
import {collectionGroup,runTransaction} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';
import {reviewToll} from './toll-review.js';
const panel=document.getElementById('panel-tolls'),list=document.getElementById('pendingTolls'),message=document.getElementById('tollReviewStatus');
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let stop=null,generation=0,revision=0;
async function decide(reference,decision,button){
 const uid=auth.currentUser?.uid,version=generation;if(!uid||button.disabled)return;button.disabled=true;message.textContent='Saving admin decision…';
 try{
  const changed=await runTransaction(db,async transaction=>{
   if(auth.currentUser?.uid!==uid)throw Error('Sign in again.');
   const adminRef=doc(db,'admins',uid),rideRef=reference.parent.parent;
   const [admin,claim,ride]=await Promise.all([transaction.get(adminRef),transaction.get(reference),transaction.get(rideRef)]);
   if(!admin.exists()||admin.data().active!==true)throw Error('Active admin access required.');
   if(!claim.exists()||!ride.exists())throw Error('Toll claim or ride is unavailable.');
   const result=reviewToll(ride.data(),claim.data(),uid,decision,reference.id);if(!result)return false;
   if(result.ridePatch)transaction.update(rideRef,result.ridePatch);
   transaction.update(reference,{...result.review,reviewedAt:serverTimestamp()});return true;
  });
  if(version!==generation)return;
  message.textContent=changed?(decision==='approved'?'Toll approved. Rider total, driver reimbursement, and receipts have updated.':'Toll rejected. No charge or reimbursement was added.'):'This toll has already been reviewed. No duplicate charge was added.';
 }catch(error){if(version===generation)message.textContent=error.code==='permission-denied'?'Review could not be saved. Publish the updated Firestore toll rules and check admin access.':error.message||'Unable to save the decision.';}
 finally{button.disabled=false;}
}
onAuthStateChanged(auth,async user=>{
 const version=++generation;revision++;stop?.();stop=null;list.replaceChildren();message.textContent='Sign in as an active admin to review toll claims.';
 if(!user)return;
 try{
  const admin=await getDoc(doc(db,'admins',user.uid));if(version!==generation)return;
  if(!admin.exists()||admin.data().active!==true)return;
  message.textContent='Loading toll submissions…';
  stop=onSnapshot(collectionGroup(db,'tollEvents'),async snapshot=>{
   if(version!==generation)return;const current=++revision;list.replaceChildren();
   const pending=snapshot.docs.filter(item=>item.data().status==='pending'&&item.ref.parent.parent?.parent.id==='rides');
   message.textContent=pending.length+' toll submissions awaiting admin confirmation.';
   for(const item of pending){
    const data=item.data(),card=document.createElement('article');card.className='card';
    const title=document.createElement('h3');title.textContent=money(data.amount)+' — '+data.location;
    const info=document.createElement('p');info.textContent='Ride: '+item.ref.parent.parent.id+' | Driver: '+data.driverId;
    const date=document.createElement('p');date.textContent='Submitted: '+(data.createdAt?.toDate?data.createdAt.toDate().toLocaleString():'Pending timestamp');
    const approve=document.createElement('button');approve.type='button';approve.textContent='Approve toll';approve.onclick=()=>decide(item.ref,'approved',approve);
    const reject=document.createElement('button');reject.type='button';reject.textContent='Reject toll';reject.onclick=()=>decide(item.ref,'rejected',reject);
    card.append(title,info,date,approve,reject);list.append(card);
    try{const ride=await getDoc(item.ref.parent.parent);if(version!==generation||current!==revision)return;
     if(ride.exists()){const r=ride.data();info.textContent='Ride: '+ride.id+' | Driver: '+(r.driverName||data.driverId)+' | Rider: '+(r.riderName||r.riderId)+' | '+(r.pickup||'Pickup')+' → '+(r.dropoff||'Destination');}
    }catch{}
   }
  },()=>{if(version!==generation)return;revision++;list.replaceChildren();message.textContent='Unable to load toll submissions. Publish the updated Firestore toll rules and verify admin access.';});
 }catch{if(version===generation)message.textContent='Unable to verify admin access.';}
});
