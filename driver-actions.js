const steps = [
  { status: 'requested', label: '+ Accept Job', className: 'acceptRide' },
  { status: 'accepted', label: 'Arrive at Pickup', className: 'arrivedRide' },
  { status: 'arrived', label: 'Start Ride', className: 'startRide' },
  { status: 'started', label: 'Complete Ride', className: 'completeRide' }
];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function actionButtons(ride, uid) {
  const owns = Boolean(uid) && ride.driverId === uid;
  return '<div class="ride-actions">' + steps.map(step => {
    const enabled = Boolean(uid) && ride.status === step.status
      && (step.status === 'requested'
        ? !ride.driverId && ride.pricingStatus !== 'quote_required'
        : owns);
    return `<button type="button" class="rideAction ${step.className}" data-id="${escape(ride.id)}" ${enabled ? '' : 'disabled'}>${step.label}</button>`;
  }).join('') + '</div>';
}
