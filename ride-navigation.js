import {validCoordinates} from './ride-details.js';
export function navigationLinks(ride,target='pickup') {
 const point=ride[target==='pickup'?'pickupLocation':'dropoffLocation'];
 const address=String(ride[target==='pickup'?'pickup':'dropoff']||'').trim();
 const destination=validCoordinates(point)?`${point.lat},${point.lng}`:address;
 if(!destination)return null;
 const encoded=encodeURIComponent(destination);
 return {
  google:`https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving&dir_action=navigate`,
  waze:`https://waze.com/ul?${validCoordinates(point)?'ll':'q'}=${encoded}&navigate=yes`,
  apple:`https://maps.apple.com/?daddr=${encoded}&dirflg=d`
 };
}
