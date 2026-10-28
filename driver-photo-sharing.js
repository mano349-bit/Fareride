import {validDriverPhoto} from './driver-photos.js';
export const PHOTO_RIDE_STATUSES = ['accepted', 'arrived', 'started'];
export function applicationDriverPhotos(application) {
  const portrait = application?.documents?.driverPortrait?.image;
  const vehicle = application?.documents?.vehicleFront?.image;
  if (!validDriverPhoto(portrait) || !validDriverPhoto(vehicle)) return null;
  return {portrait, vehicle, plateNumber: String(application.plateNumber || '').slice(0,40)};
}
// Sharing runs separately from job acceptance, so a photo permission error cannot block a job.
export async function shareDriverPhotos({ride, uid, isCurrent, readShared, readApplication, writeShared}) {
  const valid = () => isCurrent() && ride.driverId === uid && PHOTO_RIDE_STATUSES.includes(ride.status);
  if (!valid()) return false;
  const shared = await readShared();
  if (!valid()) return false;
  if (shared?.driverId === uid) return true;
  const application = await readApplication();
  if (!valid()) return false;
  const photos = applicationDriverPhotos(application);
  if (!photos) throw new Error('Your driver application needs both a vehicle front photo and a passport-style face photo. Contact the administrator.');
  await writeShared({...photos, driverId:uid});
  return valid();
}
