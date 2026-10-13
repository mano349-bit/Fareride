import {reviewWindow} from './driver-review-dates.js';
import {calendarRange,datedRecords} from './admin-calendar-dates.js';

const ranges = new Map();
const controls = new Map();
const descriptions = {
  rides:'Completed rides use completion date; cancellations use cancellation date; other rides use request date.',
  emergencies:'Uses SOS alert date. Active alerts remain visible in the top banner.',
  newApplicants:'Uses application submission date.',
  riderApplicants:'Uses application submission date.',
  approvedDrivers:'Uses approval date, or the last update/submission date for older records.',
  approvedRiders:'Uses approval date, or the last update/submission date for older records.',
  suspendedDrivers:'Uses suspension date, or the last update/submission date for older records.',
  rates:'Uses the current rates’ last update date. Historical rate versions are not stored.'
};
export function adminRange(key) {
  if (!ranges.has(key)) ranges.set(key,{...reviewWindow(),days:1});
  return ranges.get(key);
}
export function adminRecords(items,key,kind=key) {
  const range=adminRange(key);
  return datedRecords(items,kind,range.start,range.end);
}
export function onAdminCalendar(callback) {
  window.addEventListener('fareride-admin-calendar',callback);
}
export function mountAdminCalendar(host,key) {
  const box=document.createElement('div');box.className='admin-calendar';
  const fields=document.createElement('div');fields.className='admin-calendar-fields';
  const inputs={};
  for(const [name,label,type] of [['days','Past days (1–365)','number'],['start','Start date','date'],['end','End date','date']]) {
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('input');input.type=type;input.required=name!=='days';
    input.setAttribute('aria-label',label);wrap.append(input);fields.append(wrap);inputs[name]=input;
  }
  inputs.days.min='1';inputs.days.max='365';inputs.days.step='1';
  const today=document.createElement('button');today.type='button';today.textContent='Today';fields.append(today);
  const message=document.createElement('p');message.setAttribute('role','status');
  box.append(fields,message);host.append(box);
  const sync=()=>{
    const range=adminRange(key),bounds=reviewWindow(365);
    inputs.days.value=range.days ?? '';inputs.start.value=range.start;inputs.end.value=range.end;
    inputs.start.min=inputs.end.min=bounds.earliest;inputs.start.max=inputs.end.max=bounds.end;
    message.textContent=calendarRange(range.start,range.end)
      ? (descriptions[key] || 'Uses the date of this status change.')+' Records without a saved date are excluded.'
      : 'Choose valid dates within the past 365 days, with the end date on or after the start date.';
  };
  if(!controls.has(key)) controls.set(key,new Set());controls.get(key).add(sync);
  const change=()=>{
    for(const fn of controls.get(key)) fn();
    window.dispatchEvent(new CustomEvent('fareride-admin-calendar',{detail:{key}}));
  };
  inputs.days.onchange=()=>{
    const range=reviewWindow(inputs.days.valueAsNumber);
    if(!range){inputs.days.setCustomValidity('Enter a whole number from 1 to 365.');inputs.days.reportValidity();return;}
    inputs.days.setCustomValidity('');ranges.set(key,{...range,days:inputs.days.valueAsNumber});change();
  };
  const dates=()=>{inputs.days.setCustomValidity('');ranges.set(key,{start:inputs.start.value,end:inputs.end.value,days:null});change();};
  inputs.start.onchange=inputs.end.onchange=dates;
  today.onclick=()=>{ranges.set(key,{...reviewWindow(),days:1});change();};sync();
  // Detached controls from the applicant manager are removed on its next render.
  return ()=>controls.get(key)?.delete(sync);
}

for(const panel of document.querySelectorAll('.admin-panel')) {
  const host=document.createElement('div');
  const heading=panel.querySelector('h2');
  if(heading) heading.after(host);else panel.prepend(host);
  mountAdminCalendar(host,panel.id.replace('panel-',''));
}
