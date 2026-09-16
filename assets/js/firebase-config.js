import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { initializeFirestore, setLogLevel, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, serverTimestamp, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true
});
export { firebaseConfig, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, orderBy, serverTimestamp, getDoc, runTransaction };
