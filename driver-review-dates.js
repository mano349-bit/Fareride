import {localDay, completedInRange} from './rider-history-dates.js';

export function reviewWindow(days = 1, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  const earliest = new Date(now);
  earliest.setDate(earliest.getDate() - 364);
  return {start: localDay(start), end: localDay(now), earliest: localDay(earliest)};
}

export function driverReviewsInRange(rides, start, end, now = new Date()) {
  const window = reviewWindow(365, now);
  if (start < window.earliest || end > window.end) return null;
  return completedInRange(rides, start, end);
}
