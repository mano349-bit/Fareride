export function canTip(ride, uid) {
  return Boolean(uid && ride && ride.riderId === uid && ride.status === 'completed'
    && !ride.tipSubmitted && Number(ride.tipAmount || 0) === 0
    && typeof ride.fare === 'number' && Number.isFinite(ride.fare) && ride.fare >= 0
    && ride.pricingStatus !== 'quote_required');
}
export function tipValues(fare, percent) {
  if (!Number.isFinite(fare) || fare < 0 || !Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Enter a tip percentage from 0 to 100.');
  }
  const tipAmount = Math.round(fare * percent) / 100;
  return {tipPercent:percent, tipAmount, totalFare:Math.round((fare + tipAmount) * 100) / 100, tipSubmitted:true};
}
