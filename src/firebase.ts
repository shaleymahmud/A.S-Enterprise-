import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase with configuration
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use default Firestore instance where the actual calculations (1,385 records) and cash ledger reside
export const db = getFirestore(app);


