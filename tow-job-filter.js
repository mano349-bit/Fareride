import {localDay} from './rider-history-dates.js';
export function towJobWindow(days=1,now=new Date()) {
 if(!Number.isInteger(days)||days<1||days>30)return null;
 const start=new Date(now),earliest=new Date(now);start.setDate(start.getDate()-days+1);earliest.setDate(earliest.getDate()-29);
 return {start:localDay(start),end:localDay(now),earliest:localDay(earliest)};
}
export function filterTowJobs(jobs,{start,end,limit=1,jobId=''},now=new Date()) {
 const bounds=towJobWindow(30,now);
 function day(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);return localDay(date)===value?date:null;}
 const first=day(start),last=day(end);
 if(!first||!last||start>end||start<bounds.earliest||end>bounds.end||!Number.isInteger(limit)||limit<1||limit>3)
  return {jobs:[],available:[],error:'Choose valid dates within the past 30 days and a job count from 1 to 3.'};
 last.setHours(23,59,59,999);
 const available=jobs.map(job=>({job,date:job.requestedAt?.toDate?job.requestedAt.toDate():new Date(job.requestedAt)}))
  .filter(({date})=>Number.isFinite(date.getTime())&&date>=first&&date<=last)
  .sort((a,b)=>b.date-a.date||String(a.job.id).localeCompare(String(b.job.id))).map(({job})=>job);
 return {available,jobs:jobId?available.filter(job=>job.id===jobId):available.slice(0,limit),error:null};
}
