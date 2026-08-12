import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Note: this uses in-memory persistence, meaning the user is logged out
// each time the app fully restarts. Firebase's React Native persistence
// API (getReactNativePersistence) has known compatibility issues across
// SDK versions/platforms, so we are deliberately not using it for now -
// a good candidate for "future improvements" in the report, but not
// worth the instability risk this close to the deadline.
export const auth = getAuth(app);
export const db = getFirestore(app);
