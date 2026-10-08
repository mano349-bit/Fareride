export function riderProgress(status) {
  const steps = [['accepted','Accept Job'],['started','Start Ride'],['arrived','Arrive at Pickup'],['completed','Complete Ride']];
  const current = steps.findIndex(([value]) => value === status);
  return '<div role="group" aria-label="Driver progress" style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0">'+steps.map(([value,label],index)=>{
    const reached=current>=index && current>=0;
    const note=status==='cancelled'?'Cancelled':reached?'Done':'Waiting';
    return `<button type="button" disabled aria-label="${label}: ${note}" ${index===current?'aria-current="step"':''} style="background:${reached?'#d1d5db':'#f3f4f6'};color:#374151;border:${index===current?'2px solid #6b7280':'1px solid #d1d5db'};border-radius:8px;padding:10px 14px;opacity:1;cursor:default">${label}<small style="display:block;margin-top:3px">${note}</small></button>`;
  }).join('')+'</div>';
}
