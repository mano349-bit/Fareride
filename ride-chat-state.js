const active=['accepted','started','arrived'];
const time=ride=>{const value=ride.completedAt||ride.requestedAt;return value?.toMillis?.()||Date.parse(value)||0;};
export function chatRide(rides,uid,role){
 const own=rides.filter(ride=>ride[role+'Id']===uid);
 const newest=items=>items.sort((a,b)=>time(b)-time(a)||String(a.id).localeCompare(String(b.id)))[0]||null;
 return newest(own.filter(ride=>active.includes(ride.status)))||newest(own.filter(ride=>role==='rider'&&ride.status==='requested'))||newest(own.filter(ride=>['completed','cancelled'].includes(ride.status)&&ride.driverId));
}
export function canChat(ride,uid,role){return Boolean(ride?.driverId&&ride[role+'Id']===uid&&active.includes(ride.status));}
export function chatText(value){const text=String(value||'').trim();if(!text)throw Error('Enter a message.');if(text.length>2000)throw Error('Keep messages within 2,000 characters.');return text;}
