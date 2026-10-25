// Shared by presence, the job queue, and towing. Start offline on every page load.
let online = false;
const listeners = new Set();
export const isDriverOnline = () => online;
export function setDriverOnline(value) {
 const next = value === true;
 if (next === online) return;
 online = next;
 for (const listener of listeners) listener(online);
}
export function observeDriverOnline(listener) {
 listeners.add(listener);
 listener(online);
 return () => listeners.delete(listener);
}
