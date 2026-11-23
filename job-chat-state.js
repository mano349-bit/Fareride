export const LIVE_CHAT_STATUSES = [
  'requested',
  'accepted',
  'started',
  'arrived'
];

export const CHAT_TEXT_LIMIT = 2000;

export function chatParticipant(ride, identity) {
  if (!ride || !identity?.uid) {
    return false;
  }

  return identity.role === 'admin'
    || (
      identity.role === 'rider'
      && ride.riderId === identity.uid
    )
    || (
      identity.role === 'driver'
      && ride.driverId === identity.uid
    );
}

export function canSendChat(ride, identity) {
  return chatParticipant(ride, identity)
    && LIVE_CHAT_STATUSES.includes(ride.status);
}

function rideTime(ride) {
  const value =
    ride.startedAt ||
    ride.arrivedAt ||
    ride.acceptedAt ||
    ride.requestedAt ||
    0;

  if (value?.toMillis) return value.toMillis();

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function chatJobs(rides, identity) {
  const available = rides
    .filter(ride => canSendChat(ride, identity))
    .sort((a, b) => {
      const priority = status => ({
        started: 4,
        arrived: 3,
        accepted: 2,
        requested: 1
      })[status] || 0;

      return priority(b.status) - priority(a.status)
        || rideTime(b) - rideTime(a)
        || String(b.id).localeCompare(String(a.id));
    });

  // Rider and driver chat must always follow only their current live job.
  // Admin intentionally keeps the full live-job list.
  return identity?.role === 'admin'
    ? available
    : available.slice(0, 1);
}

export function chatJobLabel(ride) {
  const fullId = String(ride.id ?? '');
  const page = globalThis.location?.pathname ?? '';

  const displayedId = /\/(rider|driver)\.html$/.test(page)
    ? fullId.slice(-4)
    : fullId;

  return [
    `${ride.pickup || 'Pickup'} → ${ride.dropoff || 'Destination'}`,
    ride.riderName || 'Rider',
    ride.status,
    displayedId
  ].join(' · ');
}

export function chatMessage(ride, identity, value) {
  if (!canSendChat(ride, identity)) {
    throw new Error('This job is not open for messages.');
  }

  const text = String(value ?? '').trim();

  if (!text || text.length > CHAT_TEXT_LIMIT) {
    throw new Error('Enter a message of 1–2,000 characters.');
  }

  return {
    senderId: identity.uid,
    senderRole: identity.role,
    text
  };
}
