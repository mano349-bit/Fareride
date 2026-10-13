export const SOS_SERVICES = Object.freeze({
  police: 'Police',
  ambulance: 'Ambulance',
  fire: 'Fire Department'
});

export function sosServiceLabel(service) {
  return Object.hasOwn(SOS_SERVICES, service) ? SOS_SERVICES[service] : 'General SOS';
}
