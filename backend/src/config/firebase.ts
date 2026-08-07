import * as admin from "firebase-admin";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import dotenv from "dotenv";

dotenv.config();

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const keyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (!keyStr.startsWith("{")) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY in .env does not appear to be a valid JSON string.\n" +
          "Please provide the full stringified content of your Firebase Service Account private key JSON file."
        );
      }
      const serviceAccount = JSON.parse(keyStr);
      initializeApp({
        credential: cert(serviceAccount),
      });
      if (process.env.DEBUG) {
        console.log("Firebase Admin initialized successfully.");
      }
    } catch (error) {
      console.error("Error initializing Firebase Admin:\n", error instanceof Error ? error.message : error);
    }
  } else {
    if (process.env.DEBUG) {
      console.log("Firebase Admin not initialized. Provide FIREBASE_SERVICE_ACCOUNT_KEY in .env.");
    }
  }
}

export const adminDb = getApps().length ? getFirestore() : null;
export const adminAuth = getApps().length ? getAuth() : null;