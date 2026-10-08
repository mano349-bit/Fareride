export function localDay(date=new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function boundary(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(year,month-1,day);
  return localDay(date)===value ? date : null;
}
export function completedInRange(rides,start,end) {
  const first=boundary(start),last=boundary(end);
  if(!first||!last||first>last) return null;
  last.setHours(23,59,59,999);
  return rides.map(ride=>({ride,date:ride.completedAt?.toDate?ride.completedAt.toDate():new Date(ride.completedAt)}))
    .filter(({ride,date})=>ride.status==='completed'&&date>=first&&date<=last)
    .sort((a,b)=>b.date-a.date).map(({ride})=>ride);
}
