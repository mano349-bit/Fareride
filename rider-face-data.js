export const RIDER_FACE_MAX_LENGTH = 200000;
export function validRiderFace(value) {
  return typeof value === 'string' && value.length <= RIDER_FACE_MAX_LENGTH
    && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);
}
export function canSeeRiderFace(ride, driverUid) {
  return Boolean(driverUid && ride?.driverId === driverUid && ride.riderId
    && ['accepted','started','arrived'].includes(ride.status));
}
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
export function faceCropRect(width,height,centerX=.5,centerY=.5,size=.3) {
  if (![width,height,centerX,centerY,size].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid ID image dimensions.');
  // A square selection smaller than the document; the rider confirms it contains only the face.
  const side = Math.min(width,height) * clamp(size,.05,.7);
  return {x:clamp(centerX*width-side/2,0,width-side),y:clamp(centerY*height-side/2,0,height-side),width:side,height:side};
}
export function riderFaceProfile(uid,image,confirmed,updatedAt=new Date().toISOString()) {
  if (!uid || !confirmed || !validRiderFace(image)) throw new Error('Confirm a face-only crop before saving.');
  // Never include the source document, ID number, name, address or crop coordinates.
  return {uid,image,updatedAt};
}
export function ownRiderIdPath(uid,application) {
  const path=application?.documents?.driverLicense?.path;
  return typeof path === 'string' && path.startsWith('riderApplications/rider_'+uid+'/')
    && path.split('/').length===3 ? path : null;
}
