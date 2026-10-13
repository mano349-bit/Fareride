import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyExpenses} from './driver-daily-expenses.js';
const job=(id,income,date=new Date(2026,9,12))=>({id,date,earnings:{driver:income}});
test('each ride defaults to one-third of its driver earnings, rounded to cents',()=>{
 const result=dailyExpenses([job('a',92.46),job('b',42.37),job('c',200,new Date(2026,9,11))]);
 assert.equal(result.days[0].jobs[0].expense,30.82);
 assert.equal(result.days[0].jobs[1].expense,14.12);
 assert.equal(result.days[0].expense,44.94);
 assert.equal(result.expenses,111.61);assert.equal(result.net,223.22);
 assert.equal(result.days[0].jobs[0].net,61.64);
});
test('per-ride overrides increase, decrease and zero costs without changing another ride',()=>{
 const jobs=[job('a',90),job('b',60)];
 const result=dailyExpenses(jobs,{a:45,b:0});
 assert.equal(result.days[0].expense,45);assert.equal(result.net,105);assert.equal(result.days[0].estimated,false);
 assert.equal(dailyExpenses(jobs,{a:10}).days[0].jobs[1].expense,20);
 assert.equal(dailyExpenses(jobs,{}).days[0].jobs[0].expense,30);
 assert.equal(dailyExpenses(jobs,{a:100}).days[0].jobs[0].net,-10);
});
test('invalid saved values fall back and former daily overrides do not replace ride costs',()=>{
 for(const invalid of [-1,null,'',false,'invalid',Infinity])assert.equal(dailyExpenses([job('a',90)],{a:invalid}).expenses,30);
 assert.equal(dailyExpenses([job('a',90)],{'2026-10-12':100}).expenses,30);
 assert.equal(dailyExpenses([job('a',90)],{a:'12.34'}).expenses,12.34);
});
test('unpriced jobs do not fabricate a default and estimates stay provisional',()=>{
 const result=dailyExpenses([{id:'a',date:new Date(2026,9,12),earnings:null}]);
 assert.equal(result.days[0].jobs[0].expenseKnown,false);assert.equal(result.days[0].jobs[0].net,null);assert.equal(result.days[0].estimated,true);
 assert.equal(dailyExpenses([{...job('a',90),earnings:{driver:90,estimated:true}}],{a:10}).days[0].estimated,true);
});
