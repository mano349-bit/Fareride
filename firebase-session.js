const authScope = path => { const page = path.toLowerCase(); return page.includes('driver') ? 'driver' : page.includes('rider') ? 'rider' : page.includes('admin') ? 'admin' : 'public'; };
// FareRide Firebase connection
// Project: fareride-app-0907-349

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  initializeAuth,
  browserSessionPersistence, browserLocalPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_ri9GaLTC6rOyNuCL8Q-kBDMnB75zlOg",
  authDomain: "fareride-app-0907-349.firebaseapp.com",
  projectId: "fareride-app-0907-349",
  storageBucket: "fareride-app-0907-349.firebasestorage.app",
  messagingSenderId: "615024272118",
  appId: "1:615024272118:web:03d9c4325ec3daf78a02d7"
};

const app = initializeApp(firebaseConfig, 'FareRide-' + authScope(location.pathname));
const db = getFirestore(app);
// Avoid IndexedDB probes: Safari can stall them even when local storage is first.
// Rider/driver/admin sessions remain separate, with local and session storage.
const auth = initializeAuth(app, { persistence: [browserLocalPersistence, browserSessionPersistence] });
const storage = getStorage(app);
// Report unavailable uploads promptly instead of retrying for many minutes.
storage.maxUploadRetryTime = 30000;

export {
  app,
  db,
  auth,
  storage,

  // Firestore
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,

  // Authentication
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,

  // Storage
  ref,
  uploadBytes
};

console.log("FareRide Firebase connected");
