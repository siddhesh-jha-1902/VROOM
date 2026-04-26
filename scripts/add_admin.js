import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBWbB1FIj3cxsWIvynP-9R-MtcVbrlfc64",
  authDomain: "vroom-platform.firebaseapp.com",
  projectId: "vroom-platform",
  storageBucket: "vroom-platform.firebasestorage.app",
  messagingSenderId: "1002355025556",
  appId: "1:1002355025556:web:9013474d71d6276ba73681"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const makeAdmin = async () => {
    const uid = '5GaGwzzq2EafvN0JLsb7LRW0NWG2';
    const email = 'siddheshxmafia1905@gmail.com';
    
    try {
        await setDoc(doc(db, "admins", uid), {
            email: email,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        console.log(`Successfully added user ${email} (UID: ${uid}) as an admin.`);
    } catch (error) {
        console.error("Error adding admin:", error);
    }
    
    process.exit(0);
}

makeAdmin().catch(console.error);
