import {validCoordinates} from './ride-details.js';
function distance(a,b){
 const rad=Math.PI/180,lat=(b.lat-a.lat)*rad,lng=(b.lng-a.lng)*rad;
 const h=Math.sin(lat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(lng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function locationNotice(ride){
 const {riderLocation:rider,driverLocation:driver,pickupLocation:pickup}=ride;
 if(![rider,driver,pickup].every(validCoordinates))return '';
 if(distance(rider,driver)<100&&distance(rider,pickup)>1000)return 'Both devices report nearly the same GPS location, away from the booked pickup. Testing both accounts on one device uses that device’s location. The pickup pin is separate from live GPS.';
 return '';
}
