import { initializeApp } from "firebase/app";
import { Platform } from "react-native";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// These values connect our app to OUR specific Firebase project.
// They are safe to include in client-side code (not secret keys).
const firebaseConfig = {
  apiKey: "AIzaSyCrGS60K54qt9e5FqaJzJ1WTwboYJbifWw",
  authDomain: "studyflow-92f02.firebaseapp.com",
  projectId: "studyflow-92f02",
  storageBucket: "studyflow-92f02.firebasestorage.app",
  messagingSenderId: "580175962620",
  appId: "1:580175962620:web:00f608021f84eff4c9d279",
};

// Initialize the Firebase app with our config.
const app = initializeApp(firebaseConfig);

// Auth persistence needs to be set up differently per platform:
// - On native (iOS/Android), we use AsyncStorage so the login session
//   survives fully closing and reopening the app - this is what stops
//   the user having to log in every single time.
// - On web, getReactNativePersistence does not exist at all (it is only
//   part of Firebase's React Native bundle), so we fall back to the
//   browser's own local storage persistence instead.
//
// We use require() here (not a top-level import) for the native-only
// functions, so the web bundle never tries to load code that doesn't
// exist for it - this is what caused our earlier "not a function" crash
// on web.
let auth: ReturnType<typeof getFirestore> extends never ? never : any;

if (Platform.OS === "web") {
  const { initializeAuth, browserLocalPersistence } = require("firebase/auth");
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
} else {
  const { initializeAuth, getReactNativePersistence } = require("firebase/auth");
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export { auth };
export const db = getFirestore(app);
