import {matchesService} from './services.js';
export function isOpenDriverJob(job) {
 return job.status === 'requested' && !job.driverId;
}
export function jobMatchesFilter(job, filter='all') {
 return filter === 'all' || matchesService(job,filter);
}
export function visibleDriverJobs(jobs,uid,filter='all',online=true) {
 return jobs.filter(job=>(online&&isOpenDriverJob(job)&&jobMatchesFilter(job,filter))
  || (Boolean(uid)&&job.driverId===uid&&['accepted','arrived','started'].includes(job.status)));
}
