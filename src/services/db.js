import { db } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

// ==== SCHEMA DEFINITIONS AND HELPERS ====

/**
 * USERS SCHEMA Helper
 * users/{uid}
 * {
 *   uid: string
 *   email: string
 *   displayName: string
 *   phoneNumber: string
 *   emergencyContacts: [{ name, relation, phone }]
 *   vehicles: [{ type, number, model, color }]
 *   savedLocations: [{ title, address, lat, lng }]
 *   safetyConsent: boolean
 *   createdAt: timestamp
 * }
 */
export const createUserProfile = async (uid, userData) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp()
  }, { merge: true });
};

/**
 * DRIVERS SCHEMA Helper
 * drivers/{uid}
 * {
 *   uid: string
 *   email: string
 *   displayName: string
 *   phoneNumber: string
 *   gender: string
 *   licenseNumber: string
 *   licenseExpiry: string
 *   licensePhotoUrl: string
 *   status: 'Pending' | 'Approved' | 'Rejected' | 'Suspended'
 *   isOnline: boolean
 *   liveLocation: { lat, lng }
 *   safetyConsent: boolean
 *   createdAt: timestamp
 * }
 */
export const createDriverProfile = async (uid, driverData) => {
  const driverRef = doc(db, 'drivers', uid);
  await setDoc(driverRef, {
    ...driverData,
    status: 'Pending',
    isOnline: false,
    createdAt: serverTimestamp()
  }, { merge: true });
};

/**
 * TRIPS SCHEMA Helper
 * trips/{tripId}
 * {
 *   userId: string
 *   driverId: string | null
 *   pickupLocation: { address, lat, lng }
 *   dropLocation: { address, lat, lng } // Hidden from driver until OTP verified
 *   vehicleDetails: { type, number, model, color }
 *   reason: string
 *   notifyEmergencyContact: boolean
 *   status: 'Finding' | 'Assigned' | 'InProgress' | 'Completed' | 'Disrupted'
 *   otp: string
 *   fare: number
 *   distanceKm: number
 *   createdAt: timestamp
 * }
 */
export const createTripRequest = async (tripData) => {
  const tripsRef = collection(db, 'trips');
  return await addDoc(tripsRef, {
    ...tripData,
    status: 'Finding',
    createdAt: serverTimestamp()
  });
};

export const updateTripStatus = async (tripId, updates) => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, updates);
};

export const claimTrip = async (tripId, driverData) => {
  const tripRef = doc(db, 'trips', tripId);
  return runTransaction(db, async (transaction) => {
    const tripDoc = await transaction.get(tripRef);
    if (!tripDoc.exists()) {
      throw new Error('Trip does not exist.');
    }
    if (tripDoc.data().status !== 'Finding') {
      throw new Error('Trip is no longer available.');
    }
    transaction.update(tripRef, { 
      status: 'Assigned', 
      ...driverData 
    });
  });
};

/**
 * Platform Stats Helper
 * Used on the landing page to dynamically show total completed rides and verified drivers
 */
export const getPlatformStats = async () => {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/stats`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    return {
      totalTrips: data.totalTrips,
      totalDrivers: data.totalDrivers
    };
  } catch (err) {
    console.error("Error fetching platform stats:", err);
    // Return zeros so it doesn't look like mock data if fetch fails
    return { totalTrips: 0, totalDrivers: 0 };
  }
};
