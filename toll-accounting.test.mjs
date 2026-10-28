import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tollUpdate,riderTotal,tollAmount} from './toll-accounting.js';
import {amounts} from './admin-financials.js';
import {dailyExpenses} from './driver-daily-expenses.js';
import {receiptFolders} from './Receipts/receipt-data.js';
const ride={id:'trip',driverId:'d',riderId:'r',status:'completed',fare:100,tipAmount:10,totalFare:110};
test('tolls are added once to rider total and 100% to driver payout',()=>{
 const updated={...ride,...tollUpdate(ride,'d',{amount:7.25,location:'Bridge'},'event')};
 assert.equal(riderTotal(updated),117.25);assert.equal(amounts(updated).driver,92.25);
 assert.equal(amounts(updated).rider-amounts(updated).driver,25);
 assert.equal(riderTotal({...updated,tipAmount:20,totalFare:120}),127.25);
 assert.equal(receiptFolders([updated],'r','rider')[0].total,117.25);
 assert.equal(receiptFolders([updated],'d','driver')[0].tolls,7.25);
});
test('multiple crossings add using integer cents and reject invalid amounts',()=>{
 const first={...ride,...tollUpdate(ride,'d',{amount:.1,location:'A'},'a')};
 assert.equal(tollUpdate(first,'d',{amount:.2,location:'B'},'b').tollsAmount,.3);
 for(const amount of [-1,0,NaN,Infinity,1.001,501])assert.throws(()=>tollUpdate(ride,'d',{amount,location:'A'},'a'));
 assert.throws(()=>tollUpdate(ride,'other',{amount:2,location:'A'},'a'));
 assert.throws(()=>tollUpdate({...ride,status:'requested'},'d',{amount:2,location:'A'},'a'));
});
test('legacy totals are not double charged and require reconciliation before new tolls',()=>{
 const legacy={...ride,tollsAmount:4,totalFare:114};assert.equal(riderTotal(legacy),114);
 assert.throws(()=>tollUpdate(legacy,'d',{amount:2,location:'A'},'a'));
 assert.equal(riderTotal({}),null);assert.equal(tollAmount({}),0);
});
test('toll reimbursement is excluded from the default expense estimate',()=>{
 const job={...ride,date:new Date('2026-10-28'),earnings:{driver:90,tolls:15}};
 const report=dailyExpenses([job]);assert.equal(report.expenses,25);assert.equal(report.net,65);
});
test('recorded payouts can explicitly declare toll reimbursement already included',()=>{
 const r={...ride,tollsAmount:5,tollAccounting:'separate-v1',driverEarnings:90};
 assert.equal(amounts(r).driver,95);assert.equal(amounts({...r,driverEarningsIncludesTolls:true}).driver,90);
});
