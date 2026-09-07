// FareRide Firebase connection
// Project: fareride-8b2d1

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
  getAuth,
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
  apiKey: "AIzaSyCIqlfkTWWSWv7lG9OmHE0ppB86vBZiBKg",
  authDomain: "fareride-8b2d1.firebaseapp.com",
  projectId: "fareride-8b2d1",
  storageBucket: "fareride-8b2d1.firebasestorage.app",
  messagingSenderId: "607017232752",
  appId: "1:607017232752:web:c054c1e47be30bff6d07b5",
  measurementId: "G-PVPY1XZTXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

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
