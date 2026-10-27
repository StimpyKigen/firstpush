/**
 * Firebase SDK Initialization Module
 * 
 * Single, reusable Firebase initialization configuring Firebase App, Auth, Firestore, 
 * and Cloud Storage. Reads configuration from Vite environment variables (`import.meta.env.VITE_FIREBASE_*`)
 * with fallback to `firebase-applet-config.json`.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfigData from '../firebase-applet-config.json';

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key] as string;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch {}
  return '';
};

// Single source of truth for Firebase configuration
export const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || firebaseConfigData.apiKey || '',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfigData.authDomain || '',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || firebaseConfigData.projectId || '',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfigData.storageBucket || '',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigData.messagingSenderId || '',
  appId: getEnv('VITE_FIREBASE_APP_ID') || firebaseConfigData.appId || '',
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || firebaseConfigData.measurementId || '',
};

const databaseId = getEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || firebaseConfigData.firestoreDatabaseId || '(default)';

// Ensure Firebase is initialized only once across the entire application
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId);
  } catch {
    return getFirestore(app, databaseId);
  }
})();
export const storage: FirebaseStorage = getStorage(app);

// Startup Debug Logging
console.log('[Firebase Init Debug]', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  currentUser: auth?.currentUser ? { uid: auth.currentUser.uid, phoneNumber: auth.currentUser.phoneNumber } : null,
});

export default app;

