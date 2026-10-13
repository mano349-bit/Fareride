export const SERVICES = Object.freeze({
  ride: { name: 'Passenger ride', action: 'Request ride' },
  tow: { name: 'Tow truck', action: 'Request tow truck' },
  messenger: { name: 'Bike messenger', action: 'Request bike delivery' }
});

export function serviceName(type = 'ride') {
  return SERVICES[type]?.name || 'Unknown service';
}

export function validateServiceDetails(type, details = {}) {
  if (!SERVICES[type]) throw new Error('Choose a supported service.');
  const required = type === 'tow' ? ['vehicle', 'issue']
    : type === 'messenger' ? ['packageDescription', 'recipientName'] : [];
  const clean = {};
  for (const key of required) {
    const value = String(details[key] || '').trim();
    if (!value) throw new Error(type === 'tow'
      ? 'Enter the vehicle and towing reason.'
      : 'Enter the package description and recipient name.');
    if (value.length > 500) throw new Error('Keep each service detail under 500 characters.');
    clean[key] = value;
  }
  if (type === 'tow') {
    const vehicleClass = details.vehicleClass || 'light';
    if (!['light','specialty'].includes(vehicleClass)) throw new Error('Choose a supported towing category.');
    clean.vehicleClass = vehicleClass;
  }
  return clean;
}

export function matchesService(job, type) {
  return (job.serviceType || 'ride') === type;
}

export function priceLabel(job, formatMoney) {
  return job.pricingStatus === 'quote_required' ? 'Quote required' : (job.serviceType === 'tow' && job.pricingStatus === 'estimated' ? 'Estimated ' : '') + formatMoney(job.fare);
}
