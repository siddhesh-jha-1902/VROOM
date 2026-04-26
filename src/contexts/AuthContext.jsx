import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { 
  onAuthStateChanged, 
  signInWithCustomToken, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'user', 'driver', 'admin'
  const [loading, setLoading] = useState(true);
  
  const { isLoaded: isClerkLoaded, userId: clerkUserId, getToken: getClerkToken, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  async function fetchUserRole(uid) {
    // Check if user is an admin
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    if (adminDoc.exists()) return 'admin';
    
    // Check if user is a driver
    const driverDoc = await getDoc(doc(db, 'drivers', uid));
    if (driverDoc.exists()) return 'driver';
    
    // Check if user is a standard user
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) return 'user';
    
    // Return null if no profile exists to force profile completion
    return null;
  }

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const role = await fetchUserRole(user.uid);
          setUserRole(role);
        } catch (e) {
          console.error("Error fetching user role", e);
          setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sync Clerk Auth State with Firebase Auth
  useEffect(() => {
    if (!isClerkLoaded) return;

    const syncFirebase = async () => {
      if (clerkUserId) {
        // Only sync if not already signed into Firebase with the same UID
        if (auth.currentUser?.uid !== clerkUserId) {
          try {
            const token = await getClerkToken();
            const res = await fetch(`${BACKEND_URL}/api/auth/firebase-token`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            const data = await res.json();
            if (data.token) {
              await signInWithCustomToken(auth, data.token);
            } else {
              console.error("Failed to fetch Firebase token from backend:", data.error);
            }
          } catch (err) {
            console.error("Error syncing Clerk with Firebase:", err);
          }
        }
      } else {
        // Clerk user signed out, sign out of Firebase
        if (auth.currentUser) {
          await firebaseSignOut(auth);
        }
      }
    };

    syncFirebase();
  }, [clerkUserId, isClerkLoaded, getClerkToken, BACKEND_URL]);

  // Wrappers to maintain backward compatibility
  // Note: Actual login/signup UI will be handled by Clerk components or hooks in Auth.jsx
  // These are kept as no-ops or placeholders to avoid breaking other components calling them.
  function signup(email, password) {
    throw new Error("signup() is now handled by Clerk UI. Do not call this directly.");
  }

  function login(email, password) {
     throw new Error("login() is now handled by Clerk UI. Do not call this directly.");
  }
  
  function loginWithGoogle() {
     throw new Error("loginWithGoogle() is now handled by Clerk UI. Do not call this directly.");
  }

  async function logout() {
    await clerkSignOut();
    return firebaseSignOut(auth);
  }

  const value = {
    currentUser, // Firebase user, matches Clerk user ID
    clerkUser,   // Raw Clerk user object containing emails, etc.
    userRole,
    setUserRole,
    login,
    signup,
    loginWithGoogle,
    logout,
    fetchUserRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && isClerkLoaded && children}
    </AuthContext.Provider>
  );
}
