export const MAX_TOW_OFFER = 100000;
export function offerAmount(value) {
 if(value==='' || value==null)throw new Error('Enter a price.');
 const amount=Number(value);
 if(!Number.isFinite(amount)||amount<0.01||amount>MAX_TOW_OFFER)throw new Error('Enter a price greater than $0 and no more than $100,000.');
 return Math.round(amount*100)/100;
}
export function checkTowOpen(ride) {
 if(ride.serviceType!=='tow'||ride.status!=='requested'||ride.driverId)throw new Error('This tow request is no longer available.');
}
export function checkOfferVersion(current,expected) {
 if((current?.revision||0)!==(expected?.revision||0))throw new Error('The offer changed. Review the latest price and try again.');
}
export function offerResponse(offer,action,value,actor='rider') {
 if(!['rider','driver'].includes(actor))throw new Error('Invalid offer participant.');
 if(!offer || !['pending','countered'].includes(offer.status))throw new Error('This offer is no longer open.');
 if(actor==='driver'){
  if(action!=='accept'||offer.status!=='countered')throw new Error('Wait for a rider counteroffer before accepting.');
  return {status:'accepted',amount:offerAmount(offer.counterAmount),revision:offer.revision+1};
 }
 if(action==='counter')return {status:'countered',counterAmount:offerAmount(value),revision:offer.revision+1};
 if(action==='decline')return {status:'declined',revision:offer.revision+1};
 if(action==='accept'&&offer.status==='pending')return {status:'accepted',revision:offer.revision+1};
 throw new Error('Choose an available offer action.');
}
export function acceptedTowFields(ride,offer,acceptedAt,actor='rider') {
 checkTowOpen(ride);
 if(!['rider','driver'].includes(actor))throw new Error('Invalid offer participant.');
 if(offer.status!==(actor==='driver'?'countered':'pending'))throw new Error(actor==='driver'?'Only a current rider counteroffer can be accepted.':'Only a current driver offer can be accepted.');
 const fare=offerAmount(actor==='driver'?offer.counterAmount:offer.amount),percent=Number(ride.tipPercent)||0;
 if(percent<0||percent>100)throw new Error('Invalid saved tip percentage.');
 const tipAmount=Math.round(fare*percent)/100;
 return {status:'accepted',pricingStatus:'agreed',fare,tipAmount,totalFare:Math.round((fare+tipAmount)*100)/100,
 driverId:offer.driverId,driverName:offer.driverName,driverPhone:offer.driverPhone,
 vehicleYear:offer.vehicleYear,vehicleMake:offer.vehicleMake,vehicleModel:offer.vehicleModel,acceptedAt};
}



export function driverOfferAmount(ride,offer) {
 checkTowOpen(ride);
 if(offer?.status==='countered')return offerAmount(offer.counterAmount);
 if(offer&&!['pending','declined'].includes(offer.status))throw new Error('This offer is no longer open.');
 if(ride.pricingStatus==='quote_required')throw new Error('The rider has not offered a price. Send a counteroffer first.');
 return offerAmount(ride.fare);
}
export function driverAcceptanceFields(ride,offer,details,acceptedAt) {
 const amount=driverOfferAmount(ride,offer);
 if(!details?.driverId||(offer&&offer.driverId!==details.driverId))throw new Error('This offer belongs to another driver.');
 const identity=offer||details;
 const accepted={driverId:identity.driverId,driverName:identity.driverName,driverPhone:identity.driverPhone,vehicleYear:identity.vehicleYear,vehicleMake:identity.vehicleMake,vehicleModel:identity.vehicleModel,
  amount,counterAmount:offer?.counterAmount??null,status:'accepted',revision:(offer?.revision||0)+1};
 return {ride:acceptedTowFields(ride,{...accepted,status:'pending'},acceptedAt),offer:accepted};
}
