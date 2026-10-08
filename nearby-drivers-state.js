import {validCoordinates} from './ride-details.js';
export function milesBetween(a,b) {
 if(!validCoordinates(a)||!validCoordinates(b))return Infinity;
 const radians=x=>x*Math.PI/180;const dLat=radians(b.lat-a.lat),dLng=radians(b.lng-a.lng);
 const value=Math.sin(dLat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dLng/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(value),Math.sqrt(Math.max(0,1-value)));
}
export function nearestDrivers(drivers,origin,service='ride',now=Date.now()) {
 if(!validCoordinates(origin))return [];
 return drivers.filter(driver=>{
  const updated=driver.updatedAt?.toMillis?.() ?? Date.parse(driver.updatedAt);
  return driver.available===true && (driver.serviceType||'ride')===service && Number.isFinite(updated) && now-updated>=-30000 && now-updated<=90000;
 }).map(driver=>({...driver,miles:milesBetween(origin,{lat:driver.lat,lng:driver.lng})})).filter(driver=>driver.miles<=20).sort((a,b)=>a.miles-b.miles||String(a.id).localeCompare(String(b.id))).slice(0,10);
}
