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
export function dailyAccounts(rides, days = 365, now = new Date()) {
 const start = new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
 const end = new Date(now);end.setHours(23,59,59,999);const groups = new Map();
 for(const ride of rides){
  const status = ride.status === 'requested' ? 'pending' : ['accepted','arrived','started'].includes(ride.status) ? 'active' : ['cancelled','canceled'].includes(ride.status) ? 'cancelled' : ride.status;
  if(!['pending','active','completed','cancelled'].includes(status))continue;
  const value = status === 'completed' ? ride.completedAt : status === 'cancelled' ? (ride.cancelledAt || ride.requestedAt) : ride.requestedAt;
  const date=value?.toDate?value.toDate():new Date(value);if(!Number.isFinite(date.getTime())||date<start||date>end)continue;
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const money=amounts(ride);
  for(const role of ['rider','driver']){
   const id=ride[role+'Id'];if(!id)continue;
   const key=day+':'+role+':'+id;
   const row=groups.get(key)||{day,role,id,name:ride[role+'Name']||role,pending:0,active:0,completed:0,cancelled:0,total:0,estimated:false,unpriced:0};
   row[status]++;if(status==='completed'){if(money){row.total+=money[role];row.estimated ||= role==='driver'&&money.estimated;}else row.unpriced++;}groups.set(key,row);
  }
 }
 return [...groups.values()].sort((a,b)=>b.day.localeCompare(a.day)||a.role.localeCompare(b.role)||a.name.localeCompare(b.name));
}
