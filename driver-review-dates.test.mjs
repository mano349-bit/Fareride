import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewWindow, driverReviewsInRange} from './driver-review-dates.js';

const now = new Date(2026, 9, 12, 12);
const ride = (id, completedAt, status = 'completed') => ({id, completedAt, status});

test('lookback supports 1 through 365 calendar days including today', () => {
  assert.equal(reviewWindow(undefined, now).start, '2026-10-12');
  assert.equal(reviewWindow(7, now).start, '2026-10-06');
  assert.deepEqual(reviewWindow(365, now), {start:'2025-10-13', end:'2026-10-12', earliest:'2025-10-13'});
  for (const days of [0, 366, 1.5, NaN]) assert.equal(reviewWindow(days, now), null);
});

test('selected week excludes old, future, undated and unfinished rides, newest first', () => {
  const rides = [
    ride('first', new Date(2026, 9, 6, 0)),
    ride('latest', {toDate: () => new Date(2026, 9, 12, 23, 59, 59, 999)}),
    ride('old', new Date(2026, 9, 5, 23, 59, 59)),
    ride('future', new Date(2026, 9, 13)),
    ride('undated', undefined),
    ride('unfinished', new Date(2026, 9, 12), 'started')
  ];
  const window = reviewWindow(7, now);
  assert.deepEqual(driverReviewsInRange(rides, window.start, window.end, now).map(r => r.id), ['latest', 'first']);
});

test('calendar rejects dates outside the year, invalid dates and reversed ranges', () => {
  for (const [start, end] of [
    ['2025-10-12','2026-10-12'], ['2026-10-12','2026-10-13'],
    ['2026-10-12','2026-10-11'], ['2026-02-30','2026-03-01'], ['', '2026-10-12']
  ]) assert.equal(driverReviewsInRange([], start, end, now), null);
  assert.deepEqual(driverReviewsInRange([], '2026-10-12', '2026-10-12', now), []);
  assert.equal(driverReviewsInRange([ride('boundary', new Date(2025,9,13))], '2025-10-13', '2026-10-12', now).length, 1);
});

test('lookback uses calendar days across daylight saving changes', () => {
  assert.equal(reviewWindow(7, new Date(2026, 2, 10, 12)).start, '2026-03-04');
});
