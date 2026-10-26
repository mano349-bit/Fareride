// Shared by presence, the job queue, and towing. Driver sign-in activates it automatically.
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

// Logout removes presence before Firebase drops write authorization.
let leaveSession = null, resumeSession = null;
export function registerDriverSessionLifecycle(leave, resume) { leaveSession=leave;resumeSession=resume; }
export function prepareDriverSignOut() { return leaveSession?.(); }
export function resumeDriverSession() { return resumeSession?.(); }
