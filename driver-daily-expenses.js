import {localDay} from './rider-history-dates.js';
export function dailyExpenses(jobs, saved={}) {
 const days=new Map();
 for(const job of jobs){const day=localDay(job.date);if(!days.has(day))days.set(day,{day,jobs:[],income:0});const entry=days.get(day);entry.jobs.push(job);entry.income+=job.earnings?.driver||0;}
 for(const entry of days.values()){
  const stored=Object.hasOwn(saved,entry.day)?Number(saved[entry.day]):NaN;
  entry.estimated=!Number.isFinite(stored)||stored<0;
  entry.expense=entry.estimated?Math.round(entry.income*30)/100:stored;
  entry.net=entry.income-entry.expense;
 }
 const entries=[...days.values()];
 return {days:entries,expenses:entries.reduce((sum,day)=>sum+day.expense,0),net:entries.reduce((sum,day)=>sum+day.net,0)};
}
