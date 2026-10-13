import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarRange,recordDate,datedRecords} from './admin-calendar-dates.js';
import {dailyAccounts,report360} from './admin-financials.js';
const now=new Date(2026,9,12,12);
const today='2026-10-12';
test('inclusive local days accept 1–365 days and reject invalid, reversed, old and future dates',()=>{
 assert.ok(calendarRange('2025-10-13',today,now));
 for(const [a,b] of [['2025-10-12',today],[today,'2026-10-13'],[today,'2026-10-11'],['2026-02-30',today],['',today]]) assert.equal(calendarRange(a,b,now),null);
 const records=[{id:'start',createdAt:new Date(2026,9,12,0)},{id:'last',createdAt:{toDate:()=>new Date(2026,9,12,23,59,59,999)}},{id:'old',createdAt:new Date(2026,9,11,23,59,59,999)},{id:'missing'},{id:'null',createdAt:null}];
 assert.deepEqual(datedRecords(records,'emergencies',today,today,now).map(x=>x.id),['last','start']);
});
test('rides use the date of their current status, not only request date',()=>{
 const old='2025-01-01',newDate='2026-10-12T10:00:00';
 const records=[{id:'done',status:'completed',requestedAt:old,completedAt:newDate},{id:'cancel',status:'cancelled',requestedAt:old,cancelledAt:newDate},{id:'waiting',status:'requested',requestedAt:newDate},{id:'old-done',status:'completed',requestedAt:newDate,completedAt:old},{id:'active-old',status:'started',requestedAt:old}];
 assert.deepEqual(new Set(datedRecords(records,'rides',today,today,now).map(x=>x.id)),new Set(['done','cancel','waiting']));
});
test('applicants use submission, approval or suspension dates with legacy fallbacks',()=>{
 const person={submittedAt:'2025-01-01',approvedAt:'2026-10-12T10:00:00',suspendedAt:'2026-10-11T10:00:00',updatedAt:'2026-10-10T10:00:00'};
 assert.equal(datedRecords([person],'new',today,today,now).length,0);
 assert.equal(datedRecords([person],'approved',today,today,now).length,1);
 assert.equal(datedRecords([person],'suspended',today,today,now).length,0);
 assert.equal(recordDate({approvedAt:null,updatedAt:'2026-10-12'},'approved').getFullYear(),2026);
 assert.equal(recordDate({submittedAt:'invalid'},'new'),null);
 assert.equal(datedRecords([{updatedAt:'2026-10-12'}],'rates',today,today,now).length,1);
});
test('date selection drives daily accounts and full-year totals without the old 360-day cutoff',()=>{
 const r={id:'r',status:'completed',completedAt:new Date(2025,9,13,10),fare:100,riderId:'rider',driverId:'driver'};
 const selected=datedRecords([r],'rides','2025-10-13',today,now);
 assert.equal(report360(selected,now.getTime(),365).count,1);
 assert.equal(report360(selected,now.getTime()).count,0);
 assert.equal(dailyAccounts(selected,365,now).length,2);
 assert.equal(datedRecords([r],'rides',today,today,now).length,0);
});
