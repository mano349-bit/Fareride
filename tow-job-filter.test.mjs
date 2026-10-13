import test from 'node:test';import assert from 'node:assert/strict';
import {towJobWindow,filterTowJobs} from './tow-job-filter.js';
const now=new Date(2026,9,13,12),date=(day,hour=12)=>new Date(2026,9,day,hour);
const jobs=[{id:'old',requestedAt:date(12)},{id:'first',requestedAt:date(13,8)},{id:'second',requestedAt:{toDate:()=>date(13,10)}},{id:'latest',requestedAt:date(13,11)},{id:'missing'}];
test('driver can choose the latest 1, 2 or 3 jobs, sorted by request date',()=>{
 for(const limit of [1,2,3]){
  const result=filterTowJobs(jobs,{start:'2026-10-13',end:'2026-10-13',limit},now);
  assert.deepEqual(result.jobs.map(j=>j.id),['latest','second','first'].slice(0,limit));assert.equal(result.available.length,3);
 }
});
test('individual job selection stays within the calendar range',()=>{
 assert.equal(filterTowJobs(jobs,{start:'2026-10-12',end:'2026-10-13',jobId:'old'},now).jobs[0].id,'old');
 assert.equal(filterTowJobs(jobs,{start:'2026-10-13',end:'2026-10-13',jobId:'old'},now).jobs.length,0);
});
test('lookback supports 1–30 inclusive local calendar days',()=>{
 assert.deepEqual(towJobWindow(30,now),{start:'2026-09-14',end:'2026-10-13',earliest:'2026-09-14'});
 assert.equal(towJobWindow().start,towJobWindow().end);
 for(const invalid of [0,31,1.5,NaN])assert.equal(towJobWindow(invalid,now),null);
 assert.equal(filterTowJobs([{id:'boundary',requestedAt:new Date(2026,8,14,0)}],{start:'2026-09-14',end:'2026-10-13'},now).jobs.length,1);
});
test('invalid, reversed, old and future ranges are rejected',()=>{
 for(const [start,end] of [['','2026-10-13'],['2026-10-14','2026-10-13'],['2026-09-13','2026-10-13'],['2026-10-13','2026-10-14'],['2026-09-31','2026-10-13']])assert.ok(filterTowJobs(jobs,{start,end},now).error);
 assert.ok(filterTowJobs(jobs,{start:'2026-10-13',end:'2026-10-13',limit:4},now).error);
});
