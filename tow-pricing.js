// NY light-duty towing estimate, reviewed 2026-10-13.
// Published provider rates: Road Rescue Network $99 + $5–$7/loaded mile;
// Louie Towing Brooklyn $125 + $5–$7/loaded mile.
// Use the sample hookup midpoint and mileage-range midpoint, not a market-wide average.
export const TOW_PRICING = Object.freeze({hookup:112, perMile:6});
export function calculateTowFare(miles) {
  if (!Number.isFinite(miles) || miles < 0) throw new Error('A valid towing distance is required.');
  return Math.round((TOW_PRICING.hookup + miles * TOW_PRICING.perMile) * 100) / 100;
}
