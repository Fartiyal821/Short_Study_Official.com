import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";

// Silence internal SDK offline fallback notices
try {
  setLogLevel('silent');
} catch (e) {}

const firebaseConfig = {
  apiKey: "AIzaSyCtg7gLeHbl1uSIrxx6laxBdxx4zVQP4CQ",
  authDomain: "shortstudy-de7d4.firebaseapp.com",
  projectId: "shortstudy-de7d4",
  storageBucket: "shortstudy-de7d4.firebasestorage.app",
  messagingSenderId: "766812137638",
  appId: "1:766812137638:web:c6fdff7b473170cd116c67"
};

export const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true
  });
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export {
  firebaseConfig,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  runTransaction,
  ref,
  uploadBytes,
  getDownloadURL
};

