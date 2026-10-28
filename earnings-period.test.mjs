import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodForDays,periodDayCount} from './earnings-period.js';
import {driverReport} from './driver-report.js';
const end='2026-10-28';
test('one day and 365-day periods include both boundary dates',()=>{
 assert.deepEqual(periodForDays(end,1),{start:end,end,days:1});
 assert.equal(periodForDays(end,365).start,'2025-10-29');
 assert.equal(periodDayCount('2025-10-29',end),365);
 assert.equal(periodDayCount('2025-10-28',end),null);
 for(const count of [0,366,1.5,NaN])assert.equal(periodForDays(end,count),null);
 assert.equal(periodForDays('2026-02-30',1),null);
});
test('period toll totals include selected completed driver rides exactly once',()=>{
 const make=(id,day,tolls,extra={})=>({id,driverId:'d',riderId:'r',status:'completed',completedAt:new Date(day+'T12:00:00').toISOString(),fare:100,tipAmount:0,totalFare:100,tollsAmount:tolls,tollAccounting:'separate-v1',...extra});
 const rides=[make('today',end,3.25),make('first','2025-10-29',4.5),make('old','2025-10-28',9),make('other',end,20,{driverId:'other'}),make('active',end,30,{status:'started'})];
 const now=new Date('2026-10-28T23:59:59');
 const today=driverReport(rides,'d',{},periodForDays(end,1),now);assert.equal(today.tolls,3.25);assert.equal(today.income,78.25);
 const year=driverReport(rides,'d',{},periodForDays(end,365),now);assert.equal(year.tolls,7.75);assert.equal(year.income,157.75);
 assert.equal(driverReport(rides,'d',{},365,now).tolls,7.75);
});
test('known toll totals remain visible when base fare is unpriced',()=>{
 const report=driverReport([{id:'quote',driverId:'d',status:'completed',completedAt:'2026-10-28T12:00:00',pricingStatus:'quote_required',tollsAmount:5}], 'd',{},periodForDays(end,1),new Date('2026-10-28T23:59:59'));
 assert.equal(report.tolls,5);assert.equal(report.unpriced,1);
});
