// Verify browser storage before Firebase can silently fall back to memory-only auth.
export async function saveLoginSession(auth, setPersistence, local, session, browser = globalThis) {
 for (const [name, persistence] of [['localStorage', local], ['sessionStorage', session]]) {
  try {
   const storage = browser[name];
   const key = 'fareride-storage-check';
   storage.setItem(key, '1');
   if (storage.getItem(key) !== '1') throw new Error('Storage write failed');
   storage.removeItem(key);
   await setPersistence(auth, persistence);
   return name;
  } catch (error) {
   // Some Safari contexts allow session storage while blocking local storage.
  }
 }
 const error = new Error('This browser cannot save your login. Open FareRide in a regular Safari tab and allow website data, then try again.');
 error.code = 'fareride/storage-blocked';
 throw error;
}
