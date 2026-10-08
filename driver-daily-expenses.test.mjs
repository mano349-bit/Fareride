import {test} from 'node:test';import assert from 'node:assert/strict';
import {dailyExpenses} from './driver-daily-expenses.js';
test('daily expense defaults to 30 percent of earnings including tips and totals across days',()=>{
 const jobs=[{date:new Date(2026,9,8),earnings:{driver:85}},{date:new Date(2026,9,8,12),earnings:{driver:15}},{date:new Date(2026,9,7),earnings:{driver:200}}];
 const result=dailyExpenses(jobs);assert.equal(result.days[0].expense,30);assert.equal(result.expenses,90);assert.equal(result.net,210);
 const changed=dailyExpenses(jobs,{'2026-10-08':50,'2026-10-07':0});assert.equal(changed.expenses,50);assert.equal(changed.net,250);assert.equal(changed.days[1].estimated,false);
 assert.equal(dailyExpenses(jobs,{'2026-10-08':-5}).days[0].expense,30);
});
