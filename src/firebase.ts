/**
 * Firebase SDK Initialization Module
 * 
 * Single, reusable Firebase initialization configuring Firebase App, Auth, Firestore, 
 * and Cloud Storage. Reads configuration from Vite environment variables (`import.meta.env.VITE_FIREBASE_*`)
 * with fallback to `firebase-applet-config.json`.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfigData from '../firebase-applet-config.json';

// Single source of truth for Firebase configuration
export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || firebaseConfigData.apiKey || '',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseConfigData.authDomain || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || firebaseConfigData.projectId || '',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseConfigData.storageBucket || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseConfigData.messagingSenderId || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || firebaseConfigData.appId || '',
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || firebaseConfigData.measurementId || '',
};

const databaseId = (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || firebaseConfigData.firestoreDatabaseId || '(default)';

// Ensure Firebase is initialized only once across the entire application
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app, databaseId);
export const storage: FirebaseStorage = getStorage(app);

// Startup Debug Logging
console.log('[Firebase Init Debug]', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  currentUser: auth?.currentUser ? { uid: auth.currentUser.uid, phoneNumber: auth.currentUser.phoneNumber } : null,
});

export default app;

