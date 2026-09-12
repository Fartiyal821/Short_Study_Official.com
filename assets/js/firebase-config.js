import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtg7gLeHb11uSIrxx6laxBdxx4zVQP4CQ",
  authDomain: "shortstudy-de7d4.firebaseapp.com",
  projectId: "shortstudy-de7d4",
  storageBucket: "shortstudy-de7d4.firebasestorage.app",
  messagingSenderId: "766812137638",
  appId: "1:766812137638:web:c6fdff7b473170cd116c67"
};

// Allow runtime override via localStorage for active development or credential updates
try {
  const localKey = localStorage.getItem("shortstudy_firebase_api_key");
  if (localKey && typeof localKey === "string" && localKey.trim().startsWith("AIzaSy")) {
    firebaseConfig.apiKey = localKey.trim();
  }
} catch (e) {
  // localStorage may be unavailable in some iframe sandboxes
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { firebaseConfig };