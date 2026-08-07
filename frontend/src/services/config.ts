import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  getFirestore,
} from "firebase/firestore";

// Read Firebase config from Vite env variables or process.env fallback.
// Provide these values in a `.env` at the project root.
const getEnv = (key: string) => {
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as { env?: Record<string, string> }).env;
    if (env) {
      return env[key];
    }
  }
  return process.env[key];
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db =
  typeof window !== "undefined"
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      })
    : getFirestore(app);
