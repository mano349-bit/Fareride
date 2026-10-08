import {milesBetween} from './nearby-drivers-state.js';
export function acceptanceTracker() {
 const states = new Map(), announced = new Set();
 return {reset(){states.clear();announced.clear();},update(ride){
  if(!ride?.id)return false;
  const previous=states.get(ride.id);states.set(ride.id,ride.status);
  const accepted=ride.driverId && ['accepted','started','arrived'].includes(ride.status);
  if(previous==='requested' && accepted && !announced.has(ride.id)){announced.add(ride.id);return true;}
  return false;
 }};
}
export function arrivalEstimate(ride, now=Date.now()) {
 const updated=ride.driverLocationUpdatedAt?.toMillis?.() ?? Date.parse(ride.driverLocationUpdatedAt);
 if(!Number.isFinite(updated)||now-updated>120000||now-updated < -30000)return null;
 const miles=milesBetween(ride.driverLocation,ride.pickupLocation);
 return Number.isFinite(miles)?{miles,minutes:Math.max(1,Math.ceil(miles))}:null;
}
export function acceptanceAnnouncement(ride) {
 return `${String(ride.driverName || 'A driver').trim()} has accepted your job from ${String(ride.pickup || 'your pickup location').trim()} to ${String(ride.dropoff || ride.destination || 'your drop-off location').trim()}.` + arrivalMessage(ride);
}

export function arrivalMessage(ride) {
 if(ride.status==='arrived')return ' Your driver has arrived at pickup.';
 const estimate=arrivalEstimate(ride);
 return estimate ? ' Your driver is about '+estimate.miles.toFixed(1)+' miles away and should arrive in approximately '+estimate.minutes+' '+(estimate.minutes===1?'minute':'minutes')+'. This is an estimate.' : ' Arrival time is pending your driver’s live location.';
}
