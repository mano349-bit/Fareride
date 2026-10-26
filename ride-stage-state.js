export const stageMessages=Object.freeze({accepted:'Driver has accepted your job.',started:'Driver has started the route.',arrived:'Driver has arrived at your location.',completed:'Driver has completed the job.'});
const order={requested:0,accepted:1,started:2,arrived:3,completed:4};
export function stageTracker(){
 const seen=new Map();
 return {reset(){seen.clear();},update(ride){
  if(!ride?.id)return null;
  const previous=seen.get(ride.id);
  if(!previous){seen.set(ride.id,{status:ride.status,driverId:ride.driverId});return null;}
  if(ride.status==='cancelled'){seen.set(ride.id,{status:ride.status,driverId:ride.driverId});return null;}
  if(!ride.driverId||!(ride.status in stageMessages)||!(previous.status in order)||order[ride.status]<=order[previous.status])return null;
  if(previous.driverId&&previous.driverId!==ride.driverId){seen.set(ride.id,{status:ride.status,driverId:ride.driverId});return null;}
  seen.set(ride.id,{status:ride.status,driverId:ride.driverId});
  return stageMessages[ride.status];
 }};
}
