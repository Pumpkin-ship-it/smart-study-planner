import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCrGS60K54qt9e5FqaJzJ1WTwboYJbifWw",
  authDomain: "studyflow-92f02.firebaseapp.com",
  projectId: "studyflow-92f02",
  storageBucket: "studyflow-92f02.firebasestorage.app",
  messagingSenderId: "580175962620",
  appId: "1:580175962620:web:00f608021f84eff4c9d279",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
