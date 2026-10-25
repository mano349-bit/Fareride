import {matchesService} from './services.js';
export function isOpenDriverJob(job) {
 return job.status === 'requested' && !job.driverId
  && (job.pricingStatus !== 'quote_required' || ['tow','messenger'].includes(job.serviceType));
}
export function jobMatchesFilter(job, filter='all') {
 return filter === 'all' || matchesService(job,filter);
}
export function visibleDriverJobs(jobs,uid,filter='all',online=true) {
 return jobs.filter(job=>(online&&isOpenDriverJob(job)&&jobMatchesFilter(job,filter))
  || (Boolean(uid)&&job.driverId===uid&&['accepted','arrived','started'].includes(job.status)));
}
