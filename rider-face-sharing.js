import {validRiderFace} from './rider-face-data.js';

const ACTIVE = ['accepted', 'arrived', 'started'];

// This controller never receives a license/ID: only the already-confirmed JPEG crop.
export function createRiderFaceSharing({
  uid, isCurrent, readShared, writeShared, onState = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now(), retryMs = 15000
}) {
  let stopped = false, image = '', jobs = new Map(), timer = null;
  const pending = new Set(), done = new Map(), attempts = new Map(), failures = new Map();
  const live = () => !stopped && isCurrent();

  function report() {
    if (!live()) return;
    const errors = [...failures.values()];
    onState(!jobs.size ? {kind:'idle'} : !image ? {kind:'missing'} : errors.length
      ? {kind:'error', error:errors[0]} : pending.size ? {kind:'sharing'}
      : [...jobs.keys()].every(id => done.get(id) === image) ? {kind:'saved'} : {kind:'waiting'});
  }
  function schedule() {
    clearTimer(timer); timer = null;
    if (!live() || !image || !jobs.size) return;
    if ([...jobs.keys()].some(id => done.get(id) !== image)) {
      timer = setTimer(() => { timer = null; flush(); }, retryMs);
    }
  }
  async function share(ride, selectedImage) {
    const id = ride.id, driverId = ride.driverId;
    const eligible = () => live() && image === selectedImage
      && jobs.get(id)?.driverId === driverId && ACTIVE.includes(jobs.get(id)?.status);
    pending.add(id); attempts.set(id, {image:selectedImage, at:now()}); failures.delete(id); report();
    try {
      const existing = await readShared(id);
      if (!eligible()) return;
      if (existing?.riderId !== uid || existing?.image !== selectedImage) {
        // Sending only these two fields prevents ID documents or metadata leaking into the job.
        await writeShared(id, {riderId:uid, image:selectedImage});
      }
      if (eligible()) { done.set(id, selectedImage); failures.delete(id); }
    } catch (error) {
      if (eligible()) failures.set(id, error);
    } finally {
      pending.delete(id);
      if (live()) { report(); flush(); }
    }
  }
  function flush() {
    if (!live()) return;
    if (image) for (const ride of jobs.values()) {
      const attempt = attempts.get(ride.id);
      if (pending.has(ride.id) || done.get(ride.id) === image
        || (attempt?.image === image && now() - attempt.at < retryMs)) continue;
      share(ride, image);
    }
    report(); schedule();
  }
  return {
    setProfile(profile) {
      if (!live()) return;
      const next = profile?.uid === uid && validRiderFace(profile.image) ? profile.image : '';
      if (next !== image) { image = next; failures.clear(); }
      flush();
    },
    setRides(rides) {
      if (!live()) return;
      jobs = new Map(rides.filter(ride => ride.riderId === uid && ride.driverId
        && ACTIVE.includes(ride.status)).map(ride => [ride.id, ride]));
      for (const id of done.keys()) if (!jobs.has(id)) done.delete(id);
      for (const id of failures.keys()) if (!jobs.has(id)) failures.delete(id);
      flush();
    },
    retry() { attempts.clear(); failures.clear(); flush(); },
    dispose() {
      stopped = true; clearTimer(timer); timer = null; image = ''; jobs.clear();
      done.clear(); failures.clear(); attempts.clear();
    }
  };
}
