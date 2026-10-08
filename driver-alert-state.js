export function newRideTracker() {
 let initialized = false; const seen = new Set();
 return {
  reset() { initialized = false; seen.clear(); },
  update(rides, service, fromCache = false) {
   if (fromCache) return [];
   const eligible = rides.filter(ride => ride.status === 'requested' && !ride.driverId && ride.pricingStatus !== 'quote_required');
   const fresh = initialized ? eligible.filter(ride => !seen.has(ride.id) && (ride.serviceType || 'ride') === service) : [];
   eligible.forEach(ride => seen.add(ride.id)); initialized = true;
   return fresh;
  }
 };
}
export function rideAnnouncement(ride) {
 const pickup = String(ride.pickup || 'the pickup location').trim();
 const dropoff = String(ride.dropoff || ride.destination || 'the drop-off location').trim();
 return `There is a new ride available from ${pickup} to ${dropoff}.`;
}
