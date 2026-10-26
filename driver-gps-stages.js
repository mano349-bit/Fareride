const rad=value=>value*Math.PI/180;
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
export function distanceMetres(a,b){
 if(!valid(a)||!valid(b))return Infinity;
 const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
 const x=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
export function gpsStageTracker(){
 let id=null,status=null,origin=null,last=null,candidate=null,leftPickup=false,awayCount=0;
 function reset(){id=status=origin=last=candidate=null;leftPickup=false;awayCount=0;}
 return {reset,update(ride,position,now=Date.now()){
  if(!ride||!['accepted','started','arrived'].includes(ride.status)){reset();return null;}
  if(id!==ride.id){reset();id=ride.id;}
  if(status!==ride.status){status=ride.status;candidate=null;origin=null;last=null;}
  const p={lat:position?.coords?.latitude,lng:position?.coords?.longitude},accuracy=position?.coords?.accuracy,t=position?.timestamp;
  if(!valid(p)||!Number.isFinite(accuracy)||accuracy<0||accuracy>50||!Number.isFinite(t)||now-t>15000||t>now+2000){candidate=null;return null;}
  if(last&&t<=last.t)return null;
  if(last&&(t-last.t>30000||distanceMetres(last.p,p)/((t-last.t)/1000)>55)){last={p,t};origin=null;candidate=null;return null;}
  const speed=last?distanceMetres(last.p,p)/((t-last.t)/1000):Infinity;
  last={p,t};origin ||= {p,t};
  if(status==='accepted'){
   if(t-origin.t>=10000&&distanceMetres(origin.p,p)>=Math.max(50,accuracy*2))return 'started';
   return null;
  }
  if(status==='arrived'){
   if(distanceMetres(p,ride.pickupLocation)>150+accuracy){awayCount++;if(awayCount>=2)leftPickup=true;}else awayCount=0;
   if(!leftPickup||distanceMetres(ride.pickupLocation,ride.dropoffLocation)<=200){candidate=null;return null;}
  }
  const target=status==='started'?ride.pickupLocation:ride.dropoffLocation;
  const near=distanceMetres(p,target)+accuracy<=100;
  if(!near||speed>3){candidate=null;return null;}
  candidate ||= {t,count:0};candidate.count++;
  if(candidate.count>=3&&t-candidate.t>=(status==='started'?15000:20000))return status==='started'?'arrived':'completed';
  return null;
 }};
}
