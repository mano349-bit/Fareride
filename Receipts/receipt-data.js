export function receiptFolders(rides, uid) {
  return rides.filter(ride => uid && ride.driverId === uid && ride.status === 'completed')
    .map(ride => {
      const date = ride.completedAt?.toDate ? ride.completedAt.toDate() : new Date(ride.completedAt || NaN);
      const amount = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
      const fare = ride.pricingStatus === 'quote_required' ? null : amount(ride.fare);
      const tip = amount(ride.tipAmount);
      const total = fare === null ? null : amount(ride.totalFare) ?? (fare + (tip ?? 0));
      return {id:String(ride.id), date:Number.isFinite(date.getTime()) ? date.toISOString() : null,
        driver:ride.driverName || 'Driver', rider:ride.riderName || 'Rider',
        pickup:ride.pickup || 'Not recorded', dropoff:ride.dropoff || 'Not recorded',
        service:ride.serviceType || 'ride', miles:amount(ride.miles), fare, tip, total};
    }).sort((a,b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id));
}
