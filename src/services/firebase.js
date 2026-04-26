import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "vroom-platform.firebaseapp.com",
  projectId: "vroom-platform",
  storageBucket: "vroom-platform.firebasestorage.app",
  messagingSenderId: "1002355025556",
  appId: "1:1002355025556:web:9013474d71d6276ba73681"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
