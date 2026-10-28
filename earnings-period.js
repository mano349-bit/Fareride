function dayValue(key){
 if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const value=Date.parse(key+'T00:00:00Z');
 return Number.isFinite(value)&&new Date(value).toISOString().slice(0,10)===key?value:null;
}
export function periodDayCount(start,end){
 const first=dayValue(start),last=dayValue(end);
 if(first===null||last===null||last<first)return null;
 const days=(last-first)/86400000+1;return days<=365?days:null;
}
export function periodForDays(end,days){
 const last=dayValue(end);
 if(last===null||!Number.isInteger(days)||days<1||days>365)return null;
 return {start:new Date(last-(days-1)*86400000).toISOString().slice(0,10),end,days};
}
