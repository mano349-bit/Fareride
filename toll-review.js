import {tollUpdate} from './toll-accounting.js';
export function reviewToll(ride,claim,adminUid,decision,eventId){
 if(!adminUid)throw Error('Sign in as an active admin.');
 if(!['approved','rejected'].includes(decision))throw Error('Choose approve or reject.');
 if(claim.status!=='pending')return null;
 if(claim.driverId!==ride.driverId)throw Error('The toll claim does not match the assigned driver.');
 const review={status:decision,reviewedBy:adminUid};
 if(decision==='rejected')return {review,ridePatch:null};
 if(claim.source!=='driver-submitted')throw Error('Unsupported toll claim.');
 return {review,ridePatch:tollUpdate(ride,ride.driverId,claim,eventId)};
}
