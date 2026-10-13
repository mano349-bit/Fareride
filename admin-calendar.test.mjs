import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {reviewWindow} from './driver-review-dates.js';
import {calendarRange,datedRecords} from './admin-calendar-dates.js';
class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.value='';}
 append(...children){this.children.push(...children);}
 setAttribute(){}
 setCustomValidity(message){this.validation=message;}
 reportValidity(){return !this.validation;}
 get valueAsNumber(){return this.value===''?NaN:Number(this.value);}
}
function setup(){
 const listeners=[];
 const sandbox={reviewWindow,calendarRange,datedRecords,Map,Set,document:{querySelectorAll:()=>[],createElement:tag=>new Element(tag)},window:{addEventListener:(_name,fn)=>listeners.push(fn),dispatchEvent:event=>listeners.forEach(fn=>fn(event))},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 const source=readFileSync(new URL('./admin-calendar.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function');
 vm.runInNewContext(source+'\nglobalThis.api={adminRange,adminRecords,mountAdminCalendar,onAdminCalendar};',sandbox);return sandbox.api;
}
test('tabs default to today, have independent ranges, support 365 days and reject 366',()=>{
 const api=setup(),rides=new Element('div'),sos=new Element('div');
 api.mountAdminCalendar(rides,'rides');api.mountAdminCalendar(sos,'emergencies');
 const fields=rides.children[0].children[0].children;
 const [days,start,end]=fields.slice(0,3).map(label=>label.children[0]);
 assert.equal(String(days.value),'1');assert.equal(start.value,end.value);
 days.value='365';days.onchange();assert.equal(api.adminRange('rides').start,reviewWindow(365).start);
 assert.equal(api.adminRange('emergencies').days,1);
 days.value='366';days.onchange();assert.match(days.validation,/1 to 365/);assert.equal(api.adminRange('rides').days,365);
 fields[3].onclick();assert.equal(api.adminRange('rides').days,1);
 start.value='2000-01-01';start.onchange();assert.deepEqual(Array.from(api.adminRecords([{requestedAt:new Date()}],'rides')),[]);
 assert.match(rides.children[0].children[1].textContent,/Choose valid dates/);
});
test('two applicant controls sharing a tab stay synchronized and notify renderers',()=>{
 const api=setup(),a=new Element('div'),b=new Element('div');let changes=0;
 api.onAdminCalendar(()=>changes++);api.mountAdminCalendar(a,'approvedDrivers');const cleanup=api.mountAdminCalendar(b,'approvedDrivers');
 const get=host=>host.children[0].children[0].children[0].children[0];
 get(a).value='30';get(a).onchange();assert.equal(get(b).value,30);assert.equal(changes,1);
 cleanup();get(a).value='7';get(a).onchange();assert.equal(get(b).value,30);assert.equal(changes,2);
});
