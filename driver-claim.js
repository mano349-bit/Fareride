// Optional application fields are display data, not job-claim prerequisites.
export function claimDriverDetails(uid, profile = {}, application = {}) {
 const value = key => application[key] ?? profile[key] ?? '';
 return {driverId:uid,driverName:value('fullName') || 'Driver',driverPhone:value('phone'),
  vehicleYear:value('vehicleYear'),vehicleMake:value('vehicleMake'),vehicleModel:value('vehicleModel')};
}
