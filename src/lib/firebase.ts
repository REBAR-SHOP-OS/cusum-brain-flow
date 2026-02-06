import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAeEA8wprJALAOGhI6MQJEUZ-NYg18x-e8",
  authDomain: "rebar-shop-floor.firebaseapp.com",
  projectId: "rebar-shop-floor",
  storageBucket: "rebar-shop-floor.firebasestorage.app",
  messagingSenderId: "444951558254",
  appId: "1:444951558254:web:f3f7015f9ddb7d66144e7f",
  measurementId: "G-XGFVQD5746"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
