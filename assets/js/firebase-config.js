import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Standard Firebase Configuration Credentials
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "shortstudy-de7d4.firebaseapp.com",
  projectId: "shortstudy-de7d4",
  storageBucket: "shortstudy-de7d4.firebasestorage.app",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
};

// Check for live custom API key saved in browser localStorage for convenient testing
try {
  const customApiKey = localStorage.getItem("shortstudy_firebase_api_key");
  if (customApiKey && customApiKey.trim().length > 10) {
    firebaseConfig.apiKey = customApiKey.trim();
  }
} catch (e) {
  console.warn("Storage access not available for custom Firebase API key", e);
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { firebaseConfig };
