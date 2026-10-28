import {riderTotal,tollAmount} from '../toll-accounting.js';
const amount=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
const date=value=>{const d=value?.toDate?value.toDate():new Date(value||NaN);return Number.isFinite(d.getTime())?d.toISOString():null;};
export function receiptFolders(rides,uid,role='driver'){
 if(!['driver','rider'].includes(role))return [];
 return rides.filter(r=>uid&&r[role+'Id']===uid&&r.status==='completed').map(r=>{
  const fare=r.pricingStatus==='quote_required'?null:amount(r.fare);
  return {id:String(r.id),date:date(r.completedAt),requestedAt:date(r.requestedAt),startedAt:date(r.startedAt),
   driver:r.driverName||'Not recorded',rider:r.riderName||'Not recorded',pickup:r.pickup||'Not recorded',dropoff:r.dropoff||'Not recorded',
   service:r.serviceType||'ride',rideType:r.rideType||'Not recorded',miles:amount(r.miles),duration:amount(r.durationMinutes),
   fare,tip:amount(r.tipAmount),tolls:r.tollsAmount!=null||r.tolls!=null?tollAmount(r):null,tax:amount(r.taxAmount),taxRate:amount(r.taxRatePercent),
   total:riderTotal(r),paymentMethod:r.paymentMethod||'Not recorded',paymentStatus:r.paymentStatus||'Not recorded',
   vehicle:[r.vehicleYear,r.vehicleMake,r.vehicleModel].filter(Boolean).join(' ')||'Not recorded'};
 }).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.id.localeCompare(b.id));
}
const money=n=>n===null?'Not recorded':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const time=s=>s?new Date(s).toLocaleString('en-US',{timeZone:'America/Chicago',timeZoneName:'short'}):'Not recorded';
export function receiptFields(r){
 return [['Receipt / Ride ID',r.id],['Rider',r.rider],['Driver',r.driver],['Requested (Louisiana time)',time(r.requestedAt)],
 ['Ride started (Louisiana time)',time(r.startedAt)],['Ride completed (Louisiana time)',time(r.date)],
 ['Pickup',r.pickup],['Destination',r.dropoff],['Service',r.service],['Ride type',r.rideType],['Vehicle',r.vehicle],
 ['Distance',r.miles===null?'Not recorded':r.miles+' miles'],['Estimated duration',r.duration===null?'Not recorded':r.duration+' minutes'],
 ['Ride price',money(r.fare)],['Tip',money(r.tip)],['Toll fee (100% to driver)',r.tolls===null?'No toll fee saved for this ride':money(r.tolls)],
 ...(r.tollItems||[]).map((item,index)=>['Toll '+(index+1)+' — '+item.location,money(item.amount)+(item.date?' | '+time(item.date):'')]),
 ...(r.tollDetailsError?[['Toll details','Individual entries could not be loaded. The recorded toll total above is unchanged.']]:[]),
 ...(r.tollDetailsLoaded&&!(r.tollItems||[]).length&&r.tolls>0?[['Toll details','Only the total was recorded for this ride.']]:[]),
 ['Louisiana tax / fee (recorded)',money(r.tax)],['Recorded tax rate',r.taxRate===null?'Not recorded':r.taxRate+'%'],
 ['Total ride fee including saved tolls',money(r.total)],['Payment method',r.paymentMethod],['Payment status',r.paymentStatus]];
}
export const receiptNote='Amounts reflect the saved ride record. Unrecorded tolls and taxes are not assumed to be zero or invented. Confirmed toll entries are added separately to the ride charge. This receipt does not confirm payment collection.';

