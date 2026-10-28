import {localDay} from './rider-history-dates.js';

export function dailyExpenses(jobs, saved = {}) {
 const days = new Map();
 for (const job of jobs) {
  const day = localDay(job.date);
  if (!days.has(day)) days.set(day, {day, jobs:[], income:0, expense:0, estimated:false});
  const entry = days.get(day);
  const raw = Object.hasOwn(saved, job.id) ? saved[job.id] : null;
  const stored = (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) ? Number(raw) : NaN;
  const expenseEstimated = !Number.isFinite(stored) || stored < 0;
  const expenseKnown = !expenseEstimated || !!job.earnings;
  const income = job.earnings?.driver || 0;
  const expense = Math.round((expenseEstimated ? Math.max(0,income - (job.earnings?.tolls || 0)) / 3 : stored) * 100) / 100;
  entry.jobs.push({...job, expense, expenseEstimated, expenseKnown, net:job.earnings ? Math.round((income-expense)*100)/100 : null});
  entry.income += income;
  entry.expense += expense;
  entry.estimated ||= expenseEstimated || !job.earnings || !!job.earnings.estimated;
 }
 for (const entry of days.values()) {
  entry.income = Math.round(entry.income * 100) / 100;
  entry.expense = Math.round(entry.expense * 100) / 100;
  entry.net = Math.round((entry.income-entry.expense) * 100) / 100;
 }
 const entries = [...days.values()];
 return {
  days:entries,
  expenses:Math.round(entries.reduce((sum,day)=>sum+day.expense,0)*100)/100,
  net:Math.round(entries.reduce((sum,day)=>sum+day.net,0)*100)/100
 };
}

