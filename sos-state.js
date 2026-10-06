export function sosError(error) {
 if(error?.code==='permission-denied')return 'Firebase blocked the SOS alert. Emergency permissions must be published.';
 if(error?.code===1)return 'Location permission was denied. Allow location access in your browser and retry.';
 if(error?.code===2)return 'Your location is unavailable. Check device location settings and retry.';
 if(error?.code===3)return 'Location timed out. Move to a place with GPS reception and retry.';
 if(error?.code==='save-timeout')return 'No server confirmation yet. The alert may still arrive. Check your connection.';
 return 'SOS could not be confirmed. Check your connection and retry.';
}
export function getSOSLocation(geolocation) {
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject({code:3}),16000);
  geolocation.getCurrentPosition(position=>{clearTimeout(timer);const {latitude,longitude,accuracy}=position.coords;if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){reject({code:2});return;}resolve({latitude,longitude,accuracy:Number.isFinite(accuracy)?accuracy:0});},error=>{clearTimeout(timer);reject(error);},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
 });
}
