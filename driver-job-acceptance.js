import {claimDriverDetails} from './driver-claim.js';

function accountChanged(){return new Error('Your account changed. Sign in again before accepting a job.');}

// A permission error is retried only after refreshing authentication and server data.
export async function acceptDriverJob({uid,currentUid,readProfile,readApplication,refreshSignIn,claim,onRecovering=()=>{}}){
 const verify=()=>{if(currentUid()!==uid)throw accountChanged();};
 for(let attempt=0;attempt<2;attempt++){
  verify();
  try{
   const [profile,application]=await Promise.all([readProfile(),readApplication().catch(()=>null)]);
   verify();
   if(!profile||profile.role!=='driver')throw new Error('Sign in with your Driver account.');
   const result=await claim(claimDriverDetails(uid,profile,application||{}));
   verify();return result;
  }catch(error){
   verify();
   const code=String(error.code||'').split('/').pop();
   if(attempt!==0||!['permission-denied','unauthenticated'].includes(code))throw error;
   onRecovering();await refreshSignIn();verify();
  }
 }
}

// Reading and claiming happen in the same transaction: only one driver can win.
export async function assignDriverJob(transaction,reference,uid,details,currentUid,acceptedAt){
 const snapshot=await transaction.get(reference);
 if(currentUid()!==uid)throw accountChanged();
 if(!snapshot.exists())throw new Error('This job is no longer available.');
 const job=snapshot.data();
 // A previous response may have been lost after a successful commit.
 if(job.driverId===uid&&['accepted','started','arrived'].includes(job.status))return job;
 if(job.status!=='requested'||job.driverId)throw new Error('This job has already been accepted or is no longer available.');
 if(job.serviceType==='tow')throw new Error('Use the towing price-offer controls for this job.');
 const changes={status:'accepted',...details,driverId:uid,acceptedAt};
 transaction.update(reference,changes);return changes;
}
