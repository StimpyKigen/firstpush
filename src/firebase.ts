/**
 * Firebase SDK Initialization Module
 * 
 * Single, reusable Firebase initialization configuring Firebase App, Auth, Firestore, 
 * and Cloud Storage. Reads configuration from Vite environment variables (`import.meta.env.VITE_FIREBASE_*`)
 * with fallback to `firebase-applet-config.json`.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Inlined production configuration from firebase-applet-config.json
// Avoids raw .json ESM import attributes issues in serverless Node runtimes (Vercel)
const firebaseConfigData = {
  projectId: 'mshindiroom-production',
  appId: '1:31480688378:web:9f8d0bd5ff526b6acc6343',
  apiKey: 'AIzaSyApRSqG1sMFmXYS8yM80s0TsUkWX65qsy8',
  authDomain: 'mshindiroom-production.firebaseapp.com',
  firestoreDatabaseId: '(default)',
  storageBucket: 'mshindiroom-production.firebasestorage.app',
  messagingSenderId: '31480688378',
  measurementId: 'G-KJ3X84XLXX',
};

const PLACEHOLDER_ENV_VALUES = new Set([
  'your-api-key',
  'your-project-id',
  'your-project-id.firebaseapp.com',
  'your-project-id.firebasestorage.app',
  '1234567890',
  '1:1234567890:web:abcdef123456',
  'G-XXXXXXXXXX',
]);

const isPlaceholderValue = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_ENV_VALUES.has(trimmed)) return true;
  if (trimmed.includes('your-project-id') || trimmed.includes('your-api-key')) return true;
  return false;
};

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      const val = String(import.meta.env[key]);
      if (!isPlaceholderValue(val)) return val;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      const val = String(process.env[key]);
      if (!isPlaceholderValue(val)) return val;
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

