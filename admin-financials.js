export function amounts(ride) {
  if (ride.pricingStatus === 'quote_required' || ride.fare == null || !Number.isFinite(Number(ride.fare))) return null;
  const fare = Math.max(0, Number(ride.fare));
  const tip = Math.max(0, Number(ride.tipAmount) || 0);
  const rider = ride.totalFare != null && Number.isFinite(Number(ride.totalFare)) ? Number(ride.totalFare) : fare + tip;
  const saved = ride.driverEarnings != null && Number.isFinite(Number(ride.driverEarnings));
  const share = Number.isFinite(Number(ride.driverSharePercent)) && ride.driverSharePercent != null ? Math.min(100, Math.max(0, Number(ride.driverSharePercent))) : 75;
  const driver = saved ? Number(ride.driverEarnings) : Math.round((fare * share / 100 + tip) * 100) / 100;
  return {rider, driver, estimated: !saved, rate: Number(ride.miles) > 0 ? fare / Number(ride.miles) : null};
}
export function report360(rides, now = Date.now()) {
  const cutoff = now - 360 * 86400000, people = new Map();
  let count = 0, rider = 0, driver = 0, excluded = 0;
  for (const ride of rides) {
    const value = ride.completedAt;
    const time = value?.toMillis ? value.toMillis() : new Date(value).getTime();
    if (ride.status !== 'completed' || !Number.isFinite(time) || time < cutoff || time > now) continue;
    const money = amounts(ride); if (!money) { excluded++; continue; }
    count++; rider += money.rider; driver += money.driver;
    for (const role of ['rider','driver']) {
      const id = ride[role+'Id']; if (!id) continue;
      const key = role+':'+id;
      const entry = people.get(key) || {role,id,name:ride[role+'Name'] || role,count:0,total:0,estimated:false};
      entry.count++;entry.total += money[role];entry.estimated ||= role === 'driver' && money.estimated;people.set(key,entry);
    }
  }
  return {count,rider,driver,excluded,people:[...people.values()]};
}
