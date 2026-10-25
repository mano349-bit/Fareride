import {amounts} from './admin-financials.js';
export function rideTableTotals(rides) {
 const result={count:rides.length,fare:0,tip:0,rider:0,driver:0,estimated:false,unpriced:0,rate:null};
 let ratedFare=0,miles=0;
 for(const ride of rides){
  const value=amounts(ride);if(!value){result.unpriced++;continue;}
  const fare=Math.max(0,Number(ride.fare)),tip=Math.max(0,Number(ride.tipAmount)||0);
  result.fare+=Math.round(fare*100);result.tip+=Math.round(tip*100);
  result.rider+=Math.round(value.rider*100);result.driver+=Math.round(value.driver*100);
  result.estimated ||= value.estimated;
  if(Number.isFinite(Number(ride.miles))&&Number(ride.miles)>0){ratedFare+=fare;miles+=Number(ride.miles);}
 }
 for(const key of ['fare','tip','rider','driver'])result[key]/=100;
 result.rate=miles>0?ratedFare/miles:null;
 return result;
}
