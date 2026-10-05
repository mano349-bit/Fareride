import { amounts } from './admin-financials.js';
export function driverReport(rides, uid, costs = {}, days = 365, now = new Date()) {
  const end = new Date(now); end.setHours(23,59,59,999);
  const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - days + 1);
  const jobs = rides.filter(r => r.driverId === uid && r.status === 'completed').map(r => {
    const date = r.completedAt?.toDate ? r.completedAt.toDate() : new Date(r.completedAt);
    const earnings = amounts(r);
    const recorded = Object.hasOwn(costs,r.id);
    const cost = recorded ? Number(costs[r.id]) : null;
    return {...r,date,earnings,cost:Number.isFinite(cost) && cost >= 0 ? cost : null};
  }).filter(r => Number.isFinite(r.date.getTime()) && r.date >= start && r.date <= end).sort((a,b)=>b.date-a.date);
  const income = jobs.reduce((s,r)=>s+(r.earnings?.driver || 0),0);
  const expenses = jobs.reduce((s,r)=>s+(r.cost || 0),0);
  return {jobs,income,expenses,net:income-expenses,missing:jobs.filter(r=>r.cost===null).length,unpriced:jobs.filter(r=>!r.earnings).length};
}
