import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDs_37CD8yasgKwkUBUVuqjYdR4sLxPZA0",
  authDomain: "as-enterprise-d9d68.firebaseapp.com",
  projectId: "as-enterprise-d9d68",
  storageBucket: "as-enterprise-d9d68.firebasestorage.app",
  messagingSenderId: "54848376477",
  appId: "1:54848376477:web:a529b32f89398e3eba8e74",
  measurementId: "G-FG7LFB3C7M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
