export function riderTripState(ride) {
  const messages = {
    requested: 'Waiting for a driver to accept your request.',
    accepted: 'Driver accepted your ride and is on the way.',
    arrived: 'Driver has arrived at pickup.',
    started: 'Your ride is in progress.',
    completed: 'Ride completed. You can request another ride.',
    cancelled: 'Ride cancelled. You can request another ride.'
  };
  return {
    message: ride.pricingStatus === 'quote_required' && ride.status === 'requested'
      ? 'Waiting for dispatch to confirm your quote.' : messages[ride.status] || 'Waiting for ride information.',
    canCancel: ['requested', 'accepted', 'arrived'].includes(ride.status),
    finished: ['completed', 'cancelled'].includes(ride.status)
  };
}
