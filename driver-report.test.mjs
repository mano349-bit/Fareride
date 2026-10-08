import test from 'node:test';import assert from 'node:assert/strict';import {driverReport} from './driver-report.js';
test('custom calendar range totals only selected jobs and preserves lifetime numbers',()=>{
 const base={driverId:'d',status:'completed',fare:100,tipAmount:10};
 const rides=[{...base,id:'old',completedAt:'2025-01-01T10:00:00'},{...base,id:'first',completedAt:'2026-10-07T00:00:00'},{...base,id:'last',completedAt:'2026-10-08T23:59:59.999'},{...base,id:'outside',completedAt:'2026-10-09T00:00:00'}];
 const now=new Date('2026-10-10T12:00:00');
 const report=driverReport(rides,'d',{first:20,last:30},{start:'2026-10-07',end:'2026-10-08'},now);
 assert.deepEqual(report.jobs.map(job=>[job.id,job.jobNumber]),[['last',3],['first',2]]);
 assert.equal(report.income,170);assert.equal(report.expenses,50);assert.equal(report.net,120);
 assert.equal(driverReport(rides,'d',{}, {start:'2026-10-08',end:'2026-10-07'},now),null);
});
test('only own completed jobs in calendar period contribute and missing costs stay explicit',()=>{const now=new Date('2026-10-05T12:00:00');const job={id:'a',driverId:'d',status:'completed',completedAt:'2026-10-05T08:00:00',fare:100,tipAmount:10};const r=driverReport([job,{...job,id:'b',driverId:'other'},{...job,id:'c',status:'cancelled'},{...job,id:'old',completedAt:'2025-01-01'}],'d',{a:20},365,now);assert.equal(r.jobs.length,1);assert.equal(r.income,85);assert.equal(r.expenses,20);assert.equal(r.net,65);assert.equal(r.missing,0);assert.equal(driverReport([job],'d',{},1,now).missing,1);});

test('job numbers start at first completed job and do not restart for date filters',()=>{
 const now=new Date('2026-10-08T12:00:00'), base={driverId:'d',status:'completed',fare:10};
 const rides=[{...base,id:'third',completedAt:'2026-10-08T10:00:00'},{...base,id:'first',completedAt:'2024-01-01T10:00:00'},{...base,id:'second',completedAt:'2026-10-07T10:00:00'},{...base,id:'other',driverId:'other',completedAt:'2023-01-01'},{...base,id:'cancelled',status:'cancelled',completedAt:'2023-01-01'}];
 assert.deepEqual(driverReport(rides,'d',{},365,now).jobs.map(j=>[j.id,j.jobNumber]),[['third',3],['second',2]]);
 assert.equal(driverReport(rides,'d',{},1,now).jobs[0].jobNumber,3);
 assert.equal(driverReport(rides.slice().reverse(),'d',{},1,now).jobs[0].jobNumber,3);
});
test('equal completion times have deterministic job numbers',()=>{
 const base={driverId:'d',status:'completed',fare:10,completedAt:'2026-10-08T10:00:00'};
 const now=new Date('2026-10-08T12:00:00');
 assert.deepEqual(driverReport([{...base,id:'b'},{...base,id:'a'}],'d',{},1,now).jobs.map(j=>[j.id,j.jobNumber]),[['b',2],['a',1]]);
});
