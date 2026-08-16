import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDDO1Q0wOi_4aQ6pxaqDXySpZlF2ncsPvc",
  authDomain: "dacosta-svalinn.com",
  projectId: "da-costa-unisoc23v1-6386-61f95",
  storageBucket: "da-costa-unisoc23v1-6386-61f95.firebasestorage.app",
  messagingSenderId: "979829518210",
  appId: "1:979829518210:web:2a3a9e03a655432923699b",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export default app;
