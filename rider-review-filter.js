import {driverReviewsInRange} from './driver-review-dates.js';
export function selectRiderReviews(rides,start,end,limit='1',now=new Date()) {
 const filtered=driverReviewsInRange(rides,start,end,now);
 if(filtered===null)return null;
 if(limit==='all')return {rides:filtered,total:filtered.length};
 const count=Number(limit);
 if(!Number.isInteger(count)||count<1)return null;
 return {rides:filtered.slice(0,count),total:filtered.length};
}
