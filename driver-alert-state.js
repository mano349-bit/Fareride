import {isOpenDriverJob,jobMatchesFilter} from './driver-jobs.js';
export function newRideTracker() {
 let initialized = false; const seen = new Set();
 return {
  reset() { initialized = false; seen.clear(); },
  update(rides, service, fromCache = false) {
   if (fromCache) return [];
   const eligible = rides.filter(isOpenDriverJob);
   const fresh = initialized ? eligible.filter(ride => !seen.has(ride.id) && jobMatchesFilter(ride,service)) : [];
   eligible.forEach(ride => seen.add(ride.id)); initialized = true;
   return fresh;
  }
 };
}
export function rideAnnouncement(ride) {
 const pickup = String(ride.pickup || 'the pickup location').trim();
 const dropoff = String(ride.dropoff || ride.destination || 'the drop-off location').trim();
 const type=ride.serviceType==='tow'?'tow truck request':ride.serviceType==='messenger'?'bike delivery request':'ride';
 return `There is a new ${type} available from ${pickup} to ${dropoff}.`;
}
