import {localDay} from './rider-history-dates.js';
import {reviewWindow} from './driver-review-dates.js';

export function calendarRange(start, end, now = new Date()) {
  const window = reviewWindow(365, now);
  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number);
    const date = new Date(y,m-1,d);
    return localDay(date) === value ? date : null;
  }
  const first = day(start), last = day(end);
  if (!first || !last || start > end || start < window.earliest || end > window.end) return null;
  last.setHours(23,59,59,999);
  return {first, last};
}

export function recordDate(item, kind) {
  const fields = kind === 'rides'
    ? (item.status === 'completed' ? ['completedAt','requestedAt'] : ['cancelled','canceled'].includes(item.status) ? ['cancelledAt','requestedAt'] : ['requestedAt'])
    : kind === 'emergencies' ? ['createdAt']
    : kind === 'approved' ? ['approvedAt','updatedAt','submittedAt']
    : kind === 'suspended' ? ['suspendedAt','updatedAt','submittedAt']
    : kind === 'deleted' ? ['deletedAt','updatedAt','submittedAt']
    : kind === 'rates' ? ['updatedAt'] : ['submittedAt','createdAt'];
  for (const field of fields) {
    const value = item[field];
    if (value == null || value === '') continue;
    const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = value?.toDate ? value.toDate() : new Date(dateOnly ? value + 'T00:00:00' : value);
    if (dateOnly && localDay(date) !== value) continue;
    if (Number.isFinite(date.getTime())) return date;
  }
  return null;
}

export function datedRecords(items, kind, start, end, now = new Date()) {
  const range = calendarRange(start,end,now);
  if (!range) return [];
  return items.map(item => ({item,date:recordDate(item,kind)}))
    .filter(({date}) => date && date >= range.first && date <= range.last)
    .sort((a,b) => b.date - a.date || String(a.item.id || '').localeCompare(String(b.item.id || '')))
    .map(({item}) => item);
}
