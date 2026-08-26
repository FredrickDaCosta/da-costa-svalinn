import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDDO1Q0wOi_4aQ6pxaqDXySpZlF2ncsPvc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dacosta-svalinn.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "da-costa-unisoc23v1-6386-61f95",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "da-costa-unisoc23v1-6386-61f95.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "979829518210",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:979829518210:web:2a3a9e03a655432923699b",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export default app;
