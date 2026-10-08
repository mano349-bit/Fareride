function requestedTime(ride){
 const value=ride.requestedAt;
 const time=value?.toMillis?value.toMillis():new Date(value).getTime();
 return Number.isFinite(time)?time:0;
}
export function latestCurrentRide(rides,uid,role){
 const statuses=role==='rider'?['requested','accepted','started','arrived']:['accepted','started','arrived'];
 return rides.filter(ride=>ride[role+'Id']===uid&&statuses.includes(ride.status))
  .sort((a,b)=>requestedTime(b)-requestedTime(a)||String(a.id).localeCompare(String(b.id)))[0]||null;
}
