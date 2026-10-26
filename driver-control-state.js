export function driverControlState(job, uid, online, accepting = false) {
 const available = Boolean(job && job.status === 'requested' && !job.driverId);
 return {
  canAccept: Boolean(uid && online && !accepting && available),
  status: !uid ? 'Sign in with your Driver account.' : !online
   ? 'Checking Driver sign-in. Jobs become available automatically when signed in.'
   : available ? 'Online: this job is available to accept.'
   : 'Online: waiting for available jobs.'
 };
}
