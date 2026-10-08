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
export function acceptanceAnnouncement(ride) {
 return `${String(ride.driverName || 'A driver').trim()} has accepted your ride request from ${String(ride.pickup || 'your pickup location').trim()} to ${String(ride.dropoff || ride.destination || 'your drop-off location').trim()}.`;
}
