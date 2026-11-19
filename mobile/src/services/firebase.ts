import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebaseConfig from '../config/firebaseConfig.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persist Firebase Auth session natively on Android/iOS via AsyncStorage
const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  }
).getReactNativePersistence;

let authInstance: Auth;
try {
  authInstance = getReactNativePersistence
    ? initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage) as never,
      })
    : getAuth(app);
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
// CRITICAL: Connect to the exact provisioned Firestore database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
