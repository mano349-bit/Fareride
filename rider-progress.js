export function riderProgress(status) {
  const steps = [['accepted','Accept Job'],['started','Start Ride'],['arrived','Arrive at Pickup'],['completed','Complete Ride']];
  const current = steps.findIndex(([value]) => value === status);
  return '<div role="group" aria-label="Driver progress" style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">'+steps.map(([value,label],index)=>{
    const reached=current>=index && current>=0;
    const note=status==='cancelled'?'Cancelled':reached?'Done':'Waiting';
    return `<button type="button" disabled aria-label="${label}: ${note}" ${index===current?'aria-current="step"':''} style="background:${reached?'#d1d5db':'#f3f4f6'};color:#374151;border:${index===current?'2px solid #6b7280':'1px solid #d1d5db'};border-radius:6px;padding:6px 8px;font-size:11px;line-height:1.2;min-height:0;min-width:0;width:auto;opacity:1;cursor:default">${label}<small style="display:block;margin-top:2px;font-size:10px">${note}</small></button>`;
  }).join('')+'</div>';
}
