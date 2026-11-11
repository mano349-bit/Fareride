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

export function chatJobs(rides, identity) {
  return rides
    .filter(ride => canSendChat(ride, identity))
    .sort((a, b) =>
      (identity?.role === 'driver' ? chatJobTime(b) - chatJobTime(a) : 0)
      || String(a.id).localeCompare(String(b.id))
    );
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

function chatJobTime(ride) {
  for (const value of [ride.acceptedAt, ride.startedAt, ride.requestedAt]) {
    const time = value?.toMillis ? value.toMillis() : value?.toDate ? value.toDate().getTime() : value == null ? NaN : new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

export function defaultChatJob(jobs, identity, selected, previousJobs = []) {
  if (!jobs.length) return selected;
  if (!selected) return jobs[0].id;
  if (identity?.role !== 'driver') return selected;
  // A new assignment takes priority over an old conversation, including read-only history.
  const previous = new Set(previousJobs.map(job => job.id));
  if (jobs.some(job => !previous.has(job.id)) || !jobs.some(job => job.id === selected)) return jobs[0].id;
  return selected;
}
