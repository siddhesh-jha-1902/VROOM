import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import Map from '../components/Map';
import { MapPin, Navigation, Car, ShieldAlert, Phone, User as UserIcon, LogOut, Clock, CalendarX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createTripRequest, updateTripStatus } from '../services/db';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import Chat from '../components/Chat';
import confetti from 'canvas-confetti';

const libraries = ['places'];

export default function UserApp() {
  const { currentUser, logout } = useAuth();
  const { addToast } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (e) { console.error('Logout error', e); }
  };
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [tripState, setTripState] = useState('IDLE'); // IDLE, CONFIRM, FINDING, ASSIGNED, IN_PROGRESS
  const [pickup, setPickup] = useState(null); // { lat, lng, address }
  const [drop, setDrop] = useState(null);
  const [showMap, setShowMap] = useState(false);
  
  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');

  const [pickupAC, setPickupAC] = useState(null);
  const [dropAC, setDropAC] = useState(null);
  const [mapSearchAC, setMapSearchAC] = useState(null);
  const [activePresetToSet, setActivePresetToSet] = useState(null);
  const [presetSearchAC, setPresetSearchAC] = useState(null);

  const [reason, setReason] = useState('Drunk/Post-party');
  const [notifyFamily, setNotifyFamily] = useState(false);
  const [rating, setRating] = useState(0);
  
  const [activeTripId, setActiveTripId] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [fare, setFare] = useState(0);
  const [distance, setDistance] = useState(0);
  const [selectingLocFor, setSelectingLocFor] = useState(null); // 'pickup' | 'drop' | null
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [driverLocation, setDriverLocation] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'booking' | 'history'
  const [pastTrips, setPastTrips] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch user profile and past trips on mount
  useEffect(() => {
    if(currentUser) {
      getDoc(doc(db, 'users', currentUser.uid)).then(docSnap => {
        if(docSnap.exists()) setUserProfile(docSnap.data());
      });
      
      const q = query(
        collection(db, 'trips'), 
        where('userId', '==', currentUser.uid), 
        where('status', '==', 'Completed')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
            return timeB - timeA;
          });
        setPastTrips(trips);
        setLoadingHistory(false);
      });
      return () => unsub();
    }
  }, [currentUser]);

  useEffect(() => {
    if (paymentStatus === 'success') {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
          zIndex: 99999
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
          zIndex: 99999
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [paymentStatus]);

  useEffect(() => {
    let unsub;
    let prevStatus = null;
    if (activeTripId) {
      unsub = onSnapshot(doc(db, 'trips', activeTripId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTripData(data);
          if (data.status === 'Assigned') { setTripState('ASSIGNED'); setShowMap(true); }
          else if (data.status === 'InProgress') { setTripState('IN_PROGRESS'); setShowMap(false); setShowChat(false); }
          else if (data.status === 'Disrupted') {
             addToast("Driver reported a vehicle breakdown! Dispatching towing service and notifying emergency contacts.", "error", 10000);
             setTripState('IDLE'); setActiveTripId(null); setShowMap(false);
          }
          else if (data.status === 'Finding') {
             // Only show cancellation toast if we were previously Assigned/InProgress
             if (prevStatus === 'Assigned' || prevStatus === 'InProgress') {
               addToast("Driver cancelled. Finding a new driver...", "info");
             }
             setTripState('FINDING'); setShowMap(false);
          }
          else if (data.status === 'Completed') {
            setTripState('COMPLETED'); setShowMap(false);
          }
          prevStatus = data.status;
        }
      });
    }
    return () => { if (unsub) unsub(); };
  }, [activeTripId]);

  useEffect(() => {
    let unsub;
    if (activeTripId && tripData?.driverId) {
      unsub = onSnapshot(doc(db, 'drivers', tripData.driverId), (docSnap) => {
        if (docSnap.exists() && docSnap.data().currentLocation) {
          setDriverLocation(docSnap.data().currentLocation);
        }
      });
    } else {
      setDriverLocation(null);
    }
    return () => { if (unsub) unsub(); };
  }, [activeTripId, tripData?.driverId]);

  const cancelTripUser = async () => {
    setConfirmModal({
      title: "Cancel Trip?",
      message: "Are you sure you want to cancel the trip?",
      confirmText: "Yes, Cancel",
      confirmStyle: "bg-red-500/20 text-red-500 border-red-500/30",
      onConfirm: async () => {
        await updateTripStatus(activeTripId, { status: 'Cancelled', cancelledBy: 'User' });
        setTripState('IDLE');
        setActiveTripId(null);
        setTripData(null);
        setShowMap(false);
        addToast("Trip cancelled", "info");
      }
    });
  };

  const triggerSOS = async () => {
     if(!activeTripId) return;
     setConfirmModal({
       title: "Trigger SOS?",
       message: "This will alert admins and your emergency contacts immediately.",
       confirmText: "Trigger Now",
       confirmStyle: "bg-red-500 hover:bg-red-600 text-white",
       onConfirm: async () => {
         try {
           // We keep the local Firestore log just in case the backend is unreachable
           const sosData = {
              tripId: activeTripId,
              userId: currentUser.uid,
              userPhone: userProfile?.phoneNumber || 'Not provided',
              driverId: tripData?.driverId || 'Pending',
              timestamp: Date.now(),
              location: driverLocation || pickup,
              status: 'Active'
           };
           await addDoc(collection(db, 'sosAlerts'), sosData);

           const emergencyEmail = userProfile?.emergencyEmail || userProfile?.emergencyContacts?.[0]?.email;
           if (emergencyEmail) {
             addToast("Sending SOS alert to your emergency contact...", "info");
             const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
             const response = await fetch(`${backendUrl}/api/sos`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 emergencyEmail,
                 subject: `EMERGENCY SOS ALERT: ${userProfile?.displayName || 'User'} needs help!`,
                 html: `<p><strong>EMERGENCY SOS ALERT</strong></p>
                        <p>${userProfile?.displayName || 'Your contact'} has triggered an SOS alert during their trip.</p>
                        <p><strong>Trip ID:</strong> ${activeTripId}</p>
                        <p><strong>Contact Phone:</strong> ${sosData.userPhone}</p>
                        <p><strong>Status:</strong> Requires immediate attention.</p>`,
                 userType: 'user',
                 userId: currentUser.uid,
                 tripId: activeTripId,
                 location: sosData.location
               })
             });
             if (response.ok) {
               addToast("SOS Triggered. Admin and Emergency Contact have been notified via email.", "error");
             } else {
                addToast("SOS logged to admin, but failed to email contact.", "warning");
             }
           } else {
             addToast("SOS Triggered. Admin notified. No emergency email found to alert.", "error");
           }
         } catch(e) { 
           console.error("SOS Trigger Error: ", e); 
           addToast("Failed to trigger SOS completely. Admins may not be notified.", "error");
         }
       }
     });
  };

  const handleRouteCalculated = (distanceMeters) => {
    setDistance(distanceMeters);
  };

  useEffect(() => {
    if (distance > 0) {
      const distanceKm = distance / 1000;
      let calculatedFare = Math.floor(50 + (distanceKm * 15));
      if (promoApplied) {
        calculatedFare = Math.floor(calculatedFare * 0.8); // Apply 20% discount
      }
      setFare(calculatedFare);
    }
  }, [distance, promoApplied]); // Re-calculate fare if promoApplied changes

  const handleReviewRequest = () => {
    if (!pickup || !drop) return addToast("Pickup and Drop locations are required.", "error");
    setDistance(0); // Reset distance to trigger recalculation animation
    setFare(0);
    setTripState('CONFIRM');
    setShowMap(true);
  };

  const onPickupChanged = () => {
    if (pickupAC !== null) {
      const place = pickupAC.getPlace();
      if(place.geometry) {
        setPickup({ address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
        setPickupText(place.formatted_address);
      }
    }
  };

  const onDropChanged = () => {
    if (dropAC !== null) {
      const place = dropAC.getPlace();
      if(place.geometry) {
        const loc = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setDrop(loc);
        setDropText(place.formatted_address);

        if (activePresetToSet && currentUser) {
          updateDoc(doc(db, 'users', currentUser.uid), {
            [`savedLocations.${activePresetToSet}`]: loc
          }).then(() => {
            addToast(`${activePresetToSet} saved successfully!`, "success");
            setActivePresetToSet(null);
            setUserProfile(prev => ({ ...prev, savedLocations: { ...prev.savedLocations, [activePresetToSet]: loc } }));
          }).catch(console.error);
        }
      }
    }
  };

  const handleMapClick = async (latLng) => {
    if (!selectingLocFor) return;
    
    // Reverse Geocode
    const geocoder = new window.google.maps.Geocoder();
    try {
      const response = await geocoder.geocode({ location: latLng });
      const address = response.results[0]?.formatted_address || "Selected from map";
      
      if (selectingLocFor === 'pickup') {
        setPickup({ lat: latLng.lat, lng: latLng.lng, address });
        setPickupText(address);
      } else {
        setDrop({ lat: latLng.lat, lng: latLng.lng, address });
        setDropText(address);
      }
      setSelectingLocFor(null);
      setShowMap(false);
    } catch (e) {
      console.error(e);
      // Fallback
      if (selectingLocFor === 'pickup') {
        setPickup({ lat: latLng.lat, lng: latLng.lng, address: "Selected on map" });
        setPickupText("Selected on map");
      } else {
        setDrop({ lat: latLng.lat, lng: latLng.lng, address: "Selected on map" });
        setDropText("Selected on map");
      }
      setSelectingLocFor(null);
      setShowMap(false);
    }
  };

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase();
    const usedCount = userProfile?.usedPromos?.[code] || 0;
    if (code === 'VROOM20') {
      if (usedCount >= 2) return setPromoError('Promo code usage limit reached');
      setPromoApplied(true); setPromoError('');
      addToast("Promo VROOM20 applied!", "success");
    } else if (code === 'WELCOME') {
      if (usedCount >= 1) return setPromoError('Promo code already used');
      setPromoApplied(true); setPromoError('');
      addToast("Promo WELCOME applied!", "success");
    } else {
      setPromoError('Invalid or expired promo code');
    }
  };

  const startSearch = async () => {
    if (!currentUser) return addToast("Please sign in first.", "error");
    setTripState('FINDING');
    
    try {
      const isEmergency = reason.includes('Drunk') || reason.includes('Medical');
      const vehicle = userProfile?.vehicles?.[0] || { type: 'Car', number: 'UNKNOWN' };

      const tripRef = await createTripRequest({
        userId: currentUser.uid,
        pickupLocation: pickup,
        dropLocation: drop,
        vehicleDetails: vehicle,
        reason: reason,
        notifyEmergencyContact: isEmergency || notifyFamily,
        fare: fare,
        distance: distance,
        otp: Math.floor(1000 + Math.random() * 9000).toString(),
      });
      setActiveTripId(tripRef.id);
      
      if (promoApplied && promoCode) {
         const code = promoCode.toUpperCase();
         const newCount = (userProfile?.usedPromos?.[code] || 0) + 1;
         await updateDoc(doc(db, 'users', currentUser.uid), {
            [`usedPromos.${code}`]: newCount
         }).catch(console.error);
         setUserProfile(prev => prev ? { ...prev, usedPromos: { ...prev.usedPromos, [code]: newCount } } : prev);
      }
      
      if(isEmergency || notifyFamily) {
        console.log("System Mock: Notified Emergency Contact - Ride Requested");
      }
    } catch (err) {
      setTripState('IDLE');
      addToast("Error finding driver: " + err.message, "error");
    }
  };

  const isCriticalReason = reason.includes('Drunk') || reason.includes('Medical');
  const primaryVehicle = userProfile?.vehicles?.[0] || { type: 'Car', number: 'Loading...' };
  const emContact = userProfile?.emergencyContacts?.[0] || { name: 'Emergency Contact' };

  const formatTripDate = (trip) => {
    const time = trip.startTime || trip.createdAt;
    if (!time) return 'Recent';
    if (typeof time === 'number') return new Date(time).toLocaleDateString();
    if (time.toDate) return time.toDate().toLocaleDateString();
    return 'Recent';
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-background transition-colors duration-500">
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
            <div className="bg-surface p-6 rounded-2xl max-w-sm w-full mx-4 border border-black/10 dark:border-white/10 shadow-2xl">
               <h3 className="text-lg font-bold mb-2 text-text-main flex items-center gap-2">{confirmModal.title}</h3>
               <p className="text-text-muted mb-6 text-sm">{confirmModal.message}</p>
               <div className="flex gap-3">
                 <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 rounded-xl bg-black/5 dark:bg-white/5 text-text-main font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Cancel</button>
                 <button onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }} className={`flex-1 py-3 rounded-xl font-bold border transition-colors ${confirmModal.confirmStyle}`}>{confirmModal.confirmText}</button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 w-full overflow-hidden">
        <Map 
          pickupLocation={pickup}
          dropLocation={(drop && tripState !== 'IDLE' && tripState !== 'COMPLETED') ? drop : null}
          status={tripState}
          driverLocation={(tripState === 'ASSIGNED' || tripState === 'IN_PROGRESS') ? (driverLocation || { lat: pickup?.lat + 0.005, lng: pickup?.lng + 0.005 }) : null}
          onRouteCalculated={handleRouteCalculated}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Floating UI Container */}
      <div className={`absolute z-40 px-4 md:px-0 pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${((tripState === 'IDLE' || tripState === 'COMPLETED' || tripState === 'IN_PROGRESS') && !showMap)
            ? 'inset-0 flex items-center justify-center bg-background border-none'
            : 'bottom-6 left-0 w-full md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:max-w-[420px]'
        }
      `}>
        <div className={`pointer-events-auto w-full transition-all duration-500 ${((tripState === 'IDLE' || tripState === 'COMPLETED' || tripState === 'IN_PROGRESS') && !showMap) ? 'max-w-[500px]' : 'max-w-[420px]'}`}>
        <AnimatePresence mode="wait">
          {tripState === 'IDLE' && selectingLocFor && (
            <motion.div key="selectingBanner" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="glass-card p-4 text-center">
              <h3 className="font-bold text-text-main text-lg mb-4">
                Click map to select {selectingLocFor === 'pickup' ? 'Pickup' : 'Drop'} location
              </h3>
              {isLoaded && (
                <div className="mb-4 relative flex items-center bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 px-3">
                  <MapPin className="text-primary w-5 h-5 mr-3 shrink-0" />
                  <Autocomplete 
                    onLoad={setMapSearchAC} 
                    onPlaceChanged={() => {
                        window.setTimeout(() => {
                            if (mapSearchAC) {
                                const place = mapSearchAC.getPlace();
                                if(place?.geometry) {
                                    const loc = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                                    if (selectingLocFor === 'pickup') {
                                        setPickup(loc); setPickupText(place.formatted_address);
                                    } else {
                                        setDrop(loc); setDropText(place.formatted_address);
                                    }
                                    setSelectingLocFor(null);
                                    setShowMap(false);
                                }
                            }
                        }, 50);
                    }} 
                    className="flex-1"
                  >
                    <input type="text" placeholder={`Search ${selectingLocFor === 'pickup' ? 'pickup' : 'drop'} location...`} className="w-full bg-transparent py-3 text-sm text-text-main placeholder-text-muted outline-none font-medium" />
                  </Autocomplete>
                </div>
              )}
              <button className="text-sm font-bold bg-black/10 dark:bg-white/10 rounded-full px-6 py-2.5 hover:bg-black/20 dark:hover:bg-white/20 transition-colors" onClick={() => { setSelectingLocFor(null); setShowMap(false); }}>Cancel</button>
            </motion.div>
          )}
          {tripState === 'IDLE' && !selectingLocFor && viewMode === 'dashboard' && (
            <motion.div key="dashboard" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
              className={`glass-card p-6 ${!showMap ? 'shadow-2xl border-white/5' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-emerald-400 rounded-full p-[3px] shrink-0 shadow-sm cursor-pointer" onClick={() => navigate('/user/profile')}>
                    <div className="w-full h-full bg-surface dark:bg-black rounded-full overflow-hidden flex items-center justify-center">
                      {currentUser?.photoURL ? (
                          <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                          <UserIcon className="w-8 h-8 text-text-muted" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-text-main cursor-pointer" onClick={() => navigate('/user/profile')}>
                        {userProfile?.displayName || userProfile?.fullName || currentUser?.displayName || 'User'}
                    </h2>
                    <p className="text-sm text-text-muted">{userProfile?.phoneNumber || userProfile?.phone || currentUser?.email || 'No contact info'}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" title="Log Out">
                  <LogOut size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                 <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/10">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Emergency Contact</p>
                    <p className="font-semibold text-text-main text-sm truncate">{userProfile?.emergencyContact || userProfile?.emergencyContacts?.[0]?.phone || 'Not Set'}</p>
                 </div>
                 <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/10">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Status</p>
                    <p className="font-semibold text-emerald-500 text-sm">Active</p>
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button onClick={() => setViewMode('booking')} className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all flex items-center justify-center gap-2">
                    <Car className="w-5 h-5" /> Book a Ride
                 </button>
                 <div className="flex gap-3">
                   <button onClick={() => setViewMode('history')} className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-black/10 dark:border-white/10">
                      <Clock className="w-4 h-4" /> Trip History
                   </button>
                   <button onClick={() => navigate('/user/profile')} className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-black/10 dark:border-white/10">
                      <UserIcon className="w-4 h-4" /> Edit Profile
                   </button>
                 </div>
              </div>
            </motion.div>
          )}

          {tripState === 'IDLE' && !selectingLocFor && viewMode === 'history' && (
            <motion.div key="history" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
               className={`glass-card p-4 sm:p-5 ${!showMap ? 'shadow-2xl border-white/5' : ''}`}
            >
              <div className="flex items-center gap-3 mb-6">
                 <button onClick={() => setViewMode('dashboard')} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors text-sm font-bold">
                    ←
                  </button>
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
                    <Clock className="text-primary w-5 h-5" /> Trip History
                  </h3>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 no-scrollbar relative">
                 {loadingHistory ? (
                   <div className="space-y-3">
                     {[1, 2, 3].map(i => (
                       <div key={i} className="bg-black/5 dark:bg-white/5 h-28 rounded-xl animate-pulse" />
                     ))}
                   </div>
                 ) : pastTrips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <CalendarX className="w-8 h-8 text-text-muted" />
                      </div>
                      <h4 className="text-lg font-bold text-text-main mb-1">No trips yet</h4>
                      <p className="text-text-muted text-sm mb-6 max-w-[200px]">Your completed trips will appear here.</p>
                      <button onClick={() => setViewMode('booking')} className="text-primary font-bold hover:underline">Book your first ride</button>
                    </div>
                 ) : (
                    <div className="relative pl-4 border-l-2 border-black/5 dark:border-white/10 space-y-6 py-2">
                      {pastTrips.map((trip, idx) => (
                         <div key={trip.id} className="relative bg-black/5 dark:bg-black/40 p-4 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/5 transition-colors">
                            <div className="absolute -left-[25px] top-4 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                            <div className="flex justify-between items-start mb-2">
                               <div>
                                  <p className="text-sm font-bold text-text-main">{formatTripDate(trip)}</p>
                                  <p className="text-xs text-text-muted">Driver: {trip.driverName || 'Unknown'}</p>
                               </div>
                               <p className="text-base font-black text-emerald-500">₹{trip.fare}</p>
                            </div>
                            <div className="flex items-start gap-2 mt-3 text-left">
                               <MapPin className="text-emerald-500 w-4 h-4 shrink-0 mt-0.5" />
                               <p className="text-[11px] text-text-main leading-tight line-clamp-2">{trip.pickupLocation?.address || 'Unknown Pickup'}</p>
                            </div>
                            <div className="flex items-start gap-2 mt-2 text-left">
                               <Navigation className="text-primary w-4 h-4 shrink-0 mt-0.5" />
                               <p className="text-[11px] text-text-main leading-tight line-clamp-2">{trip.dropLocation?.address || 'Unknown Drop'}</p>
                            </div>
                         </div>
                      ))}
                    </div>
                 )}
              </div>
            </motion.div>
          )}

          {tripState === 'IDLE' && !selectingLocFor && viewMode === 'booking' && (
            <motion.div key="book" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
              className={`glass-card p-4 sm:p-5 ${!showMap ? 'shadow-2xl border-white/5' : ''}`}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setViewMode('dashboard')} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors text-sm font-bold">
                    ←
                  </button>
                  <h3 className="text-base font-bold text-text-main flex items-center gap-2 py-0.5">
                    <Navigation className="text-primary w-4 h-4" /> Book a Ride
                  </h3>
                </div>
                {!showMap && (
                  <button onClick={() => setShowMap(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-text-main hover:bg-black/10 transition-colors text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                    <MapPin className="w-3 h-3" /> Map View
                  </button>
                )}
              </div>
              
              <div className="space-y-3 relative">
                <div className="absolute left-[17px] top-7 bottom-7 w-0.5 bg-black/10 dark:bg-white/10 -z-10" />
                <div className="relative flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0">
                    <MapPin className="text-emerald-400 w-4 h-4" />
                  </div>
                  {isLoaded ? (
                    <div className="w-full relative flex items-center">
                      <Autocomplete onLoad={setPickupAC} onPlaceChanged={onPickupChanged} className="flex-1">
                        <input type="text" placeholder="Pick up location" className="w-full bg-transparent border-b border-black/10 dark:border-white/10 focus:border-primary py-1.5 pr-8 text-sm sm:text-base text-text-main placeholder-text-muted outline-none transition-colors" value={pickupText} onChange={e => setPickupText(e.target.value)} />
                      </Autocomplete>
                      <button onClick={() => { setSelectingLocFor('pickup'); setShowMap(true); }} className="absolute right-0 text-primary hover:text-primary-hover p-1.5 transition-colors" title="Select on map">
                        <MapPin size={16} />
                      </button>
                    </div>
                  ) : (
                    <input type="text" placeholder="Loading Maps..." disabled className="w-full bg-transparent py-1.5 text-sm sm:text-base text-text-muted" />
                  )}
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 bg-primary rounded-sm" />
                  </div>
                  {isLoaded ? (
                    <div className="w-full relative flex items-center">
                      <Autocomplete onLoad={setDropAC} onPlaceChanged={onDropChanged} className="flex-1">
                        <input type="text" placeholder="Where to?" className="w-full bg-transparent border-b border-black/10 dark:border-white/10 focus:border-primary py-1.5 pr-8 text-sm sm:text-base text-text-main placeholder-text-muted outline-none transition-colors" value={dropText} onChange={e => setDropText(e.target.value)} />
                      </Autocomplete>
                      <button onClick={() => { setSelectingLocFor('drop'); setShowMap(true); }} className="absolute right-0 text-primary hover:text-primary-hover p-1.5 transition-colors" title="Select on map">
                        <MapPin size={16} />
                      </button>
                    </div>
                  ) : (
                    <input type="text" placeholder="Loading Maps..." disabled className="w-full bg-transparent py-1.5 text-sm sm:text-base text-text-muted" />
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3 ml-12 overflow-x-auto pb-1 no-scrollbar">
                {['Home', 'Office', 'Bar', 'Airport'].map(preset => {
                  const loc = userProfile?.savedLocations?.[preset];
                  const isSet = !!loc?.address;
                  return (
                    <button key={preset} onClick={() => {
                        if (isSet) {
                            setDrop(loc); setDropText(loc.address);
                        } else {
                            setActivePresetToSet(preset);
                        }
                    }} className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${isSet ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-black/5 dark:border-white/5 text-text-main'}`}>
                      {preset}
                      {!isSet && <span className="opacity-50 text-[10px]">+</span>}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {activePresetToSet && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="ml-12 mt-2 overflow-hidden">
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-text-main">Set {activePresetToSet} Address</span>
                        <button onClick={() => setActivePresetToSet(null)} className="text-xs text-text-muted hover:text-text-main">Cancel</button>
                      </div>
                      {isLoaded ? (
                        <div className="space-y-2">
                          <div className="relative flex items-center bg-background rounded-lg px-3 py-1.5 border border-black/10 dark:border-white/10">
                            <MapPin className="text-primary w-4 h-4 mr-2 shrink-0" />
                            <Autocomplete 
                              onLoad={setPresetSearchAC} 
                              onPlaceChanged={async () => {
                                window.setTimeout(async () => {
                                  if (presetSearchAC) {
                                    const place = presetSearchAC.getPlace();
                                    if(place?.geometry) {
                                      const locObj = { address: place.formatted_address, lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                                      
                                      try {
                                        await updateDoc(doc(db, 'users', currentUser.uid), {
                                          [`savedLocations.${activePresetToSet}`]: locObj
                                        });
                                        
                                        setUserProfile(prev => ({
                                          ...prev,
                                          savedLocations: {
                                            ...(prev?.savedLocations || {}),
                                            [activePresetToSet]: locObj
                                          }
                                        }));
                                        
                                        setDrop(locObj);
                                        setDropText(locObj.address);
                                        setActivePresetToSet(null);
                                        addToast(`${activePresetToSet} saved successfully!`, 'success');
                                      } catch (e) {
                                        console.error(e);
                                        addToast('Failed to save location', 'error');
                                      }
                                    }
                                  }
                                }, 50);
                              }} 
                              className="flex-1"
                            >
                              <input type="text" placeholder={`Search for ${activePresetToSet}...`} autoFocus className="w-full bg-transparent text-xs text-text-main placeholder-text-muted outline-none" />
                            </Autocomplete>
                          </div>
                          {drop?.address && (
                            <button 
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'users', currentUser.uid), {
                                    [`savedLocations.${activePresetToSet}`]: drop
                                  });
                                  setUserProfile(prev => ({
                                    ...prev,
                                    savedLocations: { ...(prev?.savedLocations || {}), [activePresetToSet]: drop }
                                  }));
                                  setActivePresetToSet(null);
                                  addToast(`${activePresetToSet} saved successfully!`, 'success');
                                } catch (e) {
                                  console.error(e);
                                  addToast('Failed to save location', 'error');
                                }
                              }}
                              className="w-full py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 flex items-center justify-center gap-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Save current destination as {activePresetToSet}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-text-muted">Loading maps...</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-3 mb-4 pt-3 border-t border-black/10 dark:border-white/10">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 block">Service Details</label>
                <div className="grid gap-2">
                  <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-text-main flex justify-between items-center">
                    <span className="text-text-muted">Vehicle:</span>
                    <span className="font-bold">{primaryVehicle.type} • {primaryVehicle.number}</span>
                  </div>
                  <select className="bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary text-[13px] text-text-main" value={reason} onChange={e => setReason(e.target.value)}>
                    <option>Drunk/Post-party</option>
                    <option>Medical</option>
                    <option>Fatigue</option>
                    <option>Senior Assistance</option>
                    <option>Other</option>
                  </select>
                </div>

                {isCriticalReason ? (
                  <div className="flex items-start gap-1.5 mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-500 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                    {emContact.name} will be automatically notified with live tracking.
                  </div>
                ) : (
                  <label className="flex items-center gap-2 mt-3 text-[11px] text-text-muted cursor-pointer">
                    <input type="checkbox" checked={notifyFamily} onChange={e => setNotifyFamily(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
                    Notify {emContact.name} about this trip
                  </label>
                )}
              </div>

              <button onClick={handleReviewRequest} className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold text-base shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
                Review Request
              </button>
            </motion.div>
          )}

          {tripState === 'CONFIRM' && (
            <motion.div key="confirm" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-text-main">
                Confirm Fixed Fare
              </h3>
              
              <div className="bg-black/5 dark:bg-black/40 rounded-xl p-4 border border-black/10 dark:border-white/5 mb-6">
                <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">Distance Based Fare</p>
                <h4 className="text-4xl font-black text-emerald-500">
                  {distance === 0 ? <span className="text-2xl text-text-muted animate-pulse">Calculating...</span> : `₹${fare}`}
                </h4>
                <p className="text-xs text-text-muted mt-2">Fixed amount. Traffic or duration does not affect this fare.</p>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm text-text-main">
                  <span className="text-text-muted">Route Distance</span>
                  <span className="font-medium text-right max-w-[200px] truncate">{distance === 0 ? '...' : `${(distance / 1000).toFixed(1)} km`}</span>
                </div>
                <div className="flex justify-between text-sm text-text-main">
                  <span className="text-text-muted">Vehicle</span>
                  <span className="font-medium">{primaryVehicle.number} ({primaryVehicle.type})</span>
                </div>
              </div>

              {!promoApplied ? (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={promoCode} 
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Promo code (e.g. VROOM20)" 
                      className="flex-1 bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary uppercase font-bold text-text-main"
                    />
                    <button onClick={handleApplyPromo} className="bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 px-5 rounded-xl text-sm font-bold transition-colors">Apply</button>
                  </div>
                  {promoError && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{promoError}</p>}
                </div>
              ) : (
                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex justify-between items-center">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm tracking-widest uppercase">Promo {promoCode || 'VROOM20'} Applied</span>
                  <span className="text-xs text-text-muted">(-20%)</span>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setTripState('IDLE'); setShowMap(false); }} className="flex-1 py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main text-sm font-bold transition-colors">
                  Back
                </button>
                <button onClick={startSearch} disabled={distance === 0} className="flex-[2] bg-primary hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-base text-white shadow-lg shadow-primary/20 transition-all">
                  Confirm Booking
                </button>
              </div>
            </motion.div>
          )}

          {tripState === 'FINDING' && (
             <motion.div key="finding" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center text-text-main">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 border-[3px] border-primary/30 rounded-full animate-ping" />
                  <div className="absolute inset-0 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-md">
                    <Car className="text-primary w-10 h-10 animate-bounce" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Finding a driver...</h2>
                <p className="text-text-muted mb-8">Matching with nearby verified partners.</p>
                <button onClick={() => { updateTripStatus(activeTripId, { status: 'Cancelled' }); setTripState('IDLE'); setActiveTripId(null); setShowMap(false);}} className="w-full py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 font-bold transition-colors">
                  Cancel Search
                </button>
             </motion.div>
          )}

          {tripState === 'ASSIGNED' && tripData && (
             <motion.div key="assigned" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card overflow-hidden text-text-main">
                <div className="bg-primary/10 p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-primary dark:text-emerald-400 font-bold text-lg flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary dark:bg-emerald-400 animate-pulse" /> Partner Arriving
                    </h3>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-black/5 dark:border-white/10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-primary flex items-center justify-center text-xl text-white font-bold shadow-lg">
                      {tripData.driverName ? tripData.driverName[0] : 'P'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-base truncate">{tripData.driverName || 'Verified Partner'}</h4>
                      <p className="text-[10px] sm:text-xs text-text-muted flex items-center gap-1 whitespace-nowrap overflow-x-auto no-scrollbar">★ {tripData.driverRating ? tripData.driverRating.toFixed(1) : 'New'} <span className="mx-1">•</span> {tripData.driverTotalKm > 0 ? `${tripData.driverTotalKm} km` : 'New'} <span className="mx-1">•</span> Certified</p>
                    </div>
                    <button onClick={() => setShowChat(true)} className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-600 flex items-center justify-center hover:bg-blue-500/30 transition-colors">
                      <span className="font-bold border-b-2 border-current leading-none pb-0.5">@</span>
                    </button>
                    <a href={`tel:${tripData.driverPhone || '0000000000'}`} className="w-10 h-10 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center hover:bg-green-500/30 transition-colors">
                      <Phone size={18} />
                    </a>
                  </div>

                  <div className="bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-black/10 dark:border-white/5 text-center mb-4">
                    <p className="text-[9px] uppercase tracking-widest text-text-muted font-bold mb-1">Share this OTP with driver</p>
                    <div className="text-3xl font-mono tracking-[0.4em] font-black text-primary ml-3">{tripData.otp}</div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={cancelTripUser} className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 py-3 rounded-xl text-sm font-bold transition-colors">
                      Cancel Trip
                    </button>
                    <button onClick={triggerSOS} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl text-sm font-bold border border-red-500/20 transition-colors">
                      SOS
                    </button>
                  </div>
                </div>
             </motion.div>
          )}

          {tripState === 'IN_PROGRESS' && tripData && (
             <motion.div key="inprogress" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 border-l-4 border-l-primary text-text-main">
                 <div className="flex justify-between items-center mb-1">
                   <h3 className="text-xl font-bold">Trip in Progress</h3>
                   {!showMap && (
                     <button onClick={() => setShowMap(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold uppercase tracking-wider">
                       <MapPin className="w-3.5 h-3.5" /> Track on Map
                     </button>
                   )}
                 </div>
                 <p className="text-text-muted text-sm pb-4 mb-4 border-b border-black/5 dark:border-white/10">Driver has verified OTP. Heading to drop location.</p>
                
                 <div className="flex items-center gap-4 mb-6">
                   <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                     <Navigation className="text-primary w-5 h-5" />
                   </div>
                   <div>
                     <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-1">Destination</p>
                     <p className="font-bold">{tripData.dropLocation?.address}</p>
                   </div>
                 </div>

                 <button onClick={triggerSOS} className="w-full relative overflow-hidden group bg-red-500/10 hover:bg-red-500/20 text-red-500 py-4 rounded-xl font-bold border border-red-500/20 transition-all flex justify-center items-center gap-2 mb-3">
                   <ShieldAlert size={20} /> Trigger SOS
                 </button>

               </motion.div>
          )}

          {tripState === 'COMPLETED' && tripData && (
             <motion.div key="completed" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-0 text-text-main text-center relative w-full overflow-hidden">
                
                {paymentStatus === 'pending' && (
                  <div className="p-4 md:p-5">
                    <h3 className="text-xl md:text-2xl font-bold mb-1">Trip Completed!</h3>
                    <p className="text-text-muted mb-3 text-xs md:text-sm">Please settle the fare with your driver.</p>
                    <div className="bg-black/5 dark:bg-black/40 p-4 md:p-5 rounded-3xl mb-3 md:mb-4 border border-black/10 dark:border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-500" />
                        <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Amount Due</h4>
                        <h2 className="text-3xl md:text-4xl font-black text-emerald-500 mb-3 md:mb-4">₹{tripData.fare}</h2>
                        
                        <div className="bg-white p-2 rounded-2xl w-28 h-28 md:w-32 md:h-32 mx-auto flex items-center justify-center border-4 border-emerald-500/20 shadow-xl relative group">
                           <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=9769665211@superyes&pn=VroomPartner&am=${tripData.fare}`)}`} alt="QR Code" className="w-full h-full rounded-xl transition-transform group-hover:scale-105 duration-300" />
                           <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl" />
                        </div>
                        <p className="text-[10px] md:text-[11px] font-medium text-text-muted mt-2 md:mt-3">Scan with any UPI App</p>
                     </div>

                     <div className="flex items-center gap-4 my-3">
                       <div className="h-px bg-black/10 dark:bg-white/10 flex-1" />
                       <span className="text-[10px] font-bold text-text-muted uppercase">OR PAY VIA</span>
                       <div className="h-px bg-black/10 dark:bg-white/10 flex-1" />
                     </div>

                     <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                       <button onClick={() => {
                           setPaymentStatus('success');
                         }} className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main py-3 rounded-2xl font-bold transition-all border border-black/10 dark:border-white/10 flex items-center justify-center gap-2 text-sm">
                         <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">💵</div> Cash
                       </button>
                       <button onClick={() => {
                           setPaymentStatus('processing');
                           setTimeout(() => setPaymentStatus('success'), 2000);
                         }} className="flex-[2] bg-black dark:bg-white text-white dark:text-black hover:scale-[0.98] py-3 rounded-2xl font-bold text-sm shadow-xl shadow-black/10 dark:shadow-white/10 transition-all flex items-center justify-center gap-2 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                         <span>UPI Link / App</span>
                         <div className="w-5 h-5 rounded-full bg-white/20 text-white dark:bg-black/20 dark:text-black flex items-center justify-center text-[10px] ml-1">🚀</div>
                       </button>
                     </div>
                  </div>
                )}

                {paymentStatus === 'processing' && (
                  <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                     <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
                     <h3 className="text-xl font-bold">Processing Payment</h3>
                  </div>
                )}

                {paymentStatus === 'success' && (
                  <div className="p-8">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/20">
                      <div className="text-5xl">✅</div>
                    </div>
                    <h3 className="text-3xl font-bold mb-2">Payment Successful</h3>
                    <p className="text-text-muted mb-8">₹{tripData.fare} paid securely to Vroom Partner.</p>
                    
                    <div className="bg-black/5 dark:bg-black/40 p-6 rounded-3xl mb-8 border border-black/5 dark:border-white/5">
                       <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">Rate your Partner</h4>
                       <div className="flex justify-center gap-3 text-4xl cursor-pointer">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <motion.span whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} key={star} onClick={() => setRating(star)} className={`transition-colors ${star <= rating ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'text-black/10 dark:text-white/10 hover:text-amber-500/50'}`}>★</motion.span>
                          ))}
                       </div>
                    </div>

                    <button onClick={async () => {
                      const currentTripId = activeTripId;
                      const currentRating = rating;
                      setTripState('IDLE'); setActiveTripId(null); setTripData(null); setShowMap(false); setRating(0); setPaymentStatus('pending'); setShowChat(false); setPromoCode(''); setPromoApplied(false); setViewMode('dashboard');
                      if(currentTripId) {
                        try { await updateDoc(doc(db, 'trips', currentTripId), { userRating: currentRating }); } catch(e) { console.error(e); }
                      }
                    }} className="w-full bg-primary hover:bg-primary-hover py-4 rounded-2xl font-bold text-lg text-white shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all">
                      Done
                    </button>
                  </div>
                )}
             </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>
      
      <AnimatePresence>
        {showChat && activeTripId && currentUser && (
          <Chat 
            tripId={activeTripId} 
            currentUser={currentUser} 
            onClose={() => setShowChat(false)} 
            isDriver={false} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
