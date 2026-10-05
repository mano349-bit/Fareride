export const ACTIVE_STATUSES = ['accepted', 'arrived', 'started'];
export function driverDetails(application, uid) {
  if (application.uid !== uid || application.status !== 'approved') {
    throw new Error('An approved driver application is required.');
  }
  const fields = ['fullName', 'phone', 'vehicleYear', 'vehicleMake', 'vehicleModel'];
  if (fields.some(key => !String(application[key] || '').trim())) {
    throw new Error('Your approved application needs your name, phone and vehicle details.');
  }
  return { driverId: uid, driverName: application.fullName, driverPhone: application.phone,
    vehicleYear: application.vehicleYear, vehicleMake: application.vehicleMake,
    vehicleModel: application.vehicleModel };
}
export function validCoordinates(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
