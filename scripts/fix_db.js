import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
// Firebase config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fixTrips = async () => {
    // The two stuck trips from earlier query:
    const ids = ['7VAcPQ2hw1t00PtLzFXc', 'K6zZece9qIALOD5enZze'];
    for(const id of ids) {
        await updateDoc(doc(db, "trips", id), {
            status: "Completed"
        });
        console.log("Fixed", id);
    }
    console.log("Done");
    process.exit(0);
}

fixTrips().catch(console.error);
