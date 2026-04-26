import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Map from '../components/Map';
import { Power, MapPin, Navigation, BellRing, AlertTriangle, ShieldAlert, Key, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { updateTripStatus, claimTrip } from '../services/db';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import Chat from '../components/Chat';
import confetti from 'canvas-confetti';

export default function DriverApp() {
  const { currentUser, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (e) { console.error('Logout error', e); }
  };
  
  const [driverProfile, setDriverProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [offlineAfterTrip, setOfflineAfterTrip] = useState(false);
  const [driverState, setDriverState] = useState('IDLE');
  const driverStateRef = useRef('IDLE');
  const lastStatsRef = useRef({ rating: 0, acceptanceRate: 0, totalKm: 0 });
  const [activeRequest, setActiveRequest] = useState(null);
  const [rejectedTrips, setRejectedTrips] = useState(() => {
    try { 
      const stored = localStorage.getItem('rejectedTrips');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const now = Date.now();
      const valid = parsed.filter(item => {
        if (typeof item === 'string') return true;
        return now - item.timestamp < 24 * 60 * 60 * 1000;
      });
      return valid.map(item => typeof item === 'string' ? item : item.id);
    } catch { return []; }
  });
  const [otpInput, setOtpInput] = useState('');
  const [pastTrips, setPastTrips] = useState([]);
  const [dashboardTab, setDashboardTab] = useState('overview');
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [tripStartTime, setTripStartTime] = useState(null);
  const [tripTimer, setTripTimer] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if(currentUser) {
      getDoc(doc(db, 'drivers', currentUser.uid)).then(docSnap => {
        if(docSnap.exists()) {
          const data = docSnap.data();
          setDriverProfile(data);
          if (data.isOnline) setIsOnline(true);
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if(currentUser) {
      const q = query(
        collection(db, 'trips'), 
        where('driverId', '==', currentUser.uid), 
        where('status', '==', 'Completed')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const trips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // sort by most recent locally (assuming chronological creation)
        setPastTrips(trips.reverse());

        // Calculate Average Rating & Acceptance Rate
        const ratedTrips = trips.filter(t => typeof t.userRating === 'number' && t.userRating > 0);
        let newRating = 0;
        let newAccRate = 0;
        let hasData = false;
        
        if (ratedTrips.length > 0) {
           newRating = ratedTrips.reduce((acc, t) => acc + t.userRating, 0) / ratedTrips.length;
           hasData = true;
        }

        let newTotalKm = 0;
        trips.forEach(t => {
           if (t.distance) {
             newTotalKm += (t.distance / 1000);
           }
        });
        newTotalKm = Math.round(newTotalKm * 10) / 10;
        if (newTotalKm > 0) hasData = true;

        const currentRejects = [];
        try {
           const stored = localStorage.getItem('rejectedTrips');
           if (stored) {
             let parsed = JSON.parse(stored);
             const now = Date.now();
             parsed = parsed.filter(item => {
               if (typeof item === 'string') return true;
               return now - item.timestamp < 24 * 60 * 60 * 1000;
             });
             if (parsed.length > 50) {
               parsed = parsed.slice(-50);
             }
             localStorage.setItem('rejectedTrips', JSON.stringify(parsed));
             currentRejects.push(...parsed.map(item => typeof item === 'string' ? item : item.id));
           }
        } catch(e) {}

        const totalReqs = trips.length + currentRejects.length;
        if (totalReqs > 0) {
           newAccRate = Math.round((trips.length / totalReqs) * 100);
           hasData = true;
        }

        if (hasData) {
           const { rating, acceptanceRate, totalKm } = lastStatsRef.current;
           if (rating !== newRating || acceptanceRate !== newAccRate || totalKm !== newTotalKm) {
             updateDoc(doc(db, 'drivers', currentUser.uid), {
                rating: newRating,
                acceptanceRate: newAccRate,
                totalKm: newTotalKm
             }).catch(console.error);
             lastStatsRef.current = { rating: newRating, acceptanceRate: newAccRate, totalKm: newTotalKm };
             setDriverProfile(prev => prev ? { ...prev, rating: newRating, acceptanceRate: newAccRate, totalKm: newTotalKm } : prev);
           }
        }
        setLoadingHistory(false);
      });
      return () => unsub();
    }
  }, [currentUser]);

  useEffect(() => {
    let watchId;
    if (isOnline && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setDriverLocation(loc);
          if (currentUser) {
            updateDoc(doc(db, 'drivers', currentUser.uid), { currentLocation: loc }).catch(console.error);
          }
        },
        (error) => console.error("Error watching loc", error),
        { enableHighAccuracy: true }
      );
    }
    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, currentUser]);

  useEffect(() => {
    let interval;
    if (driverState === 'IN_PROGRESS' && activeRequest) {
      if(!tripStartTime) setTripStartTime(Date.now());
      interval = setInterval(() => {
         const start = activeRequest.startTime || tripStartTime || Date.now();
         setTripTimer(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setTripStartTime(null);
      setTripTimer(0);
    }
    return () => clearInterval(interval);
  }, [driverState, activeRequest, tripStartTime]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rs = secs % 60;
    return `${mins}:${rs < 10 ? '0' : ''}${rs}`;
  };

  const handleToggleOnline = async () => {
    if (driverProfile?.status !== 'Approved') return addToast("Your account is pending verification. You cannot go online.", "error");
    if (driverState !== 'IDLE') {
        setOfflineAfterTrip(!offlineAfterTrip);
        addToast(!offlineAfterTrip ? "You will go offline after this trip completes." : "Offline after trip cancelled.", "info");
        return;
    }
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (currentUser) {
      await updateDoc(doc(db, 'drivers', currentUser.uid), { isOnline: newStatus }).catch(console.error);
    }
    if (!newStatus) { setActiveRequest(null); setDriverState('IDLE'); }
  };

  const getStatusText = () => {
    if (driverProfile?.status !== 'Approved') return 'Pending Verification';
    return isOnline ? 'Online' : 'Offline';
  };

  // Keep a ref in sync so snapshot callbacks always read the live state
  useEffect(() => {
    driverStateRef.current = driverState;
  }, [driverState]);

  // 1. Finding Trips Listener: Only runs when driver is online and idle/reviewing a request
  useEffect(() => {
    let unsub;
    if (isOnline && currentUser && (driverState === 'IDLE' || driverState === 'REQUEST_RECEIVED')) {
      const q = query(collection(db, 'trips'), where('status', '==', 'Finding'));
      unsub = onSnapshot(q, (snapshot) => {
        // If we've already moved to EN_ROUTE or IN_PROGRESS via the recovery listener, stop here
        if (driverStateRef.current !== 'IDLE' && driverStateRef.current !== 'REQUEST_RECEIVED') return;

        const availableTrips = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(trip => !rejectedTrips.includes(trip.id));
        
        if (availableTrips.length > 0) {
          // Only update if we don't have an active trip already
          if (driverStateRef.current === 'IDLE') {
            setActiveRequest(availableTrips[0]);
            setDriverState('REQUEST_RECEIVED');
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 500]);
            }
          }
        } else {
          // If the trip we were looking at is gone, go back to IDLE
          if (driverStateRef.current === 'REQUEST_RECEIVED') {
            setActiveRequest(null);
            setDriverState('IDLE');
          }
        }
      });
    }
    return () => { if (unsub) unsub(); };
  }, [isOnline, driverState, currentUser, rejectedTrips]);

  // 2. Active Trip Recovery & Sync Listener (The Source of Truth)
  // This listener ensures that if a trip is assigned to this driver in Firestore,
  // the app reflects it immediately, even after a page refresh.
  useEffect(() => {
    let unsub;
    if (currentUser) {
      const q = query(
        collection(db, 'trips'),
        where('driverId', '==', currentUser.uid),
        where('status', 'in', ['Assigned', 'InProgress', 'Disrupted'])
      );
      unsub = onSnapshot(q, (snapshot) => {
        setIsInitializing(false);
        if (!snapshot.empty) {
          const tripData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setActiveRequest(tripData);
          setIsOnline(true); // Ensure they are marked online locally if they have a trip
          
          if (tripData.status === 'Assigned') {
            setDriverState('EN_ROUTE');
          } else if (tripData.status === 'InProgress' || tripData.status === 'Disrupted') {
            setDriverState('IN_PROGRESS');
          }
        } else {
          // If we were in a trip state but the trip is gone from the 'active' query,
          // it means it was naturally completed or cancelled.
          if (driverStateRef.current === 'EN_ROUTE' || driverStateRef.current === 'IN_PROGRESS') {
            setActiveRequest(null);
            setDriverState('IDLE');
          }
        }
      });
    } else {
      setIsInitializing(false);
    }
    return () => { if (unsub) unsub(); };
  }, [currentUser]);

  const acceptRequest = async () => {
    if (!activeRequest || !currentUser) return;
    
    // Optimistically transition state to avoid listener race conditions
    // where the 'Finding' trip disappears before the 'Assigned' trip appears.
    setDriverState('EN_ROUTE');
    
    try {
      await claimTrip(activeRequest.id, { 
        driverId: currentUser.uid,
        driverName: driverProfile?.displayName || driverProfile?.fullName || 'Vroom Partner',
        driverPhone: driverProfile?.phoneNumber || driverProfile?.phone || '',
        driverRating: driverProfile?.rating || 0,
        driverTotalKm: driverProfile?.totalKm || 0
      });

      await addDoc(collection(db, 'trips', activeRequest.id, 'messages'), {
        text: "I will arrive shortly :)",
        senderId: currentUser.uid,
        senderName: driverProfile?.displayName || driverProfile?.fullName || 'Vroom Partner',
        isDriver: true,
        timestamp: serverTimestamp(),
      });
      addToast("Trip accepted successfully!", "success");
    } catch(err) {
      addToast("Error accepting request: " + err.message, "error");
      setActiveRequest(null);
      setDriverState('IDLE');
    }
  };

  const rejectRequest = () => {
    if (activeRequest) {
      setRejectedTrips(prev => {
        const nextIds = [...prev, activeRequest.id];
        try {
          const stored = localStorage.getItem('rejectedTrips');
          let parsed = stored ? JSON.parse(stored) : [];
          parsed.push({ id: activeRequest.id, timestamp: Date.now() });
          const now = Date.now();
          parsed = parsed.filter(item => {
            if (typeof item === 'string') return true;
            return now - item.timestamp < 24 * 60 * 60 * 1000;
          });
          if (parsed.length > 50) parsed = parsed.slice(-50);
          localStorage.setItem('rejectedTrips', JSON.stringify(parsed));
        } catch(e) {}
        return nextIds;
      });
    }
    setActiveRequest(null); setDriverState('IDLE');
  }

  const cancelTrip = async () => {
    if(!activeRequest) return;
    try {
      setRejectedTrips(prev => {
        const nextIds = [...prev, activeRequest.id];
        try {
          const stored = localStorage.getItem('rejectedTrips');
          let parsed = stored ? JSON.parse(stored) : [];
          parsed.push({ id: activeRequest.id, timestamp: Date.now() });
          const now = Date.now();
          parsed = parsed.filter(item => {
            if (typeof item === 'string') return true;
            return now - item.timestamp < 24 * 60 * 60 * 1000;
          });
          if (parsed.length > 50) parsed = parsed.slice(-50);
          localStorage.setItem('rejectedTrips', JSON.stringify(parsed));
        } catch(e) {}
        return nextIds;
      });

      await updateDoc(doc(db, 'trips', activeRequest.id), { 
        status: 'Finding', 
        driverId: null, 
        driverName: null, 
        driverPhone: null, 
        driverRating: null, 
        driverTotalKm: null 
      });
      setDriverState('IDLE');
      setActiveRequest(null);
      setOtpInput('');
      setShowChat(false);
      addToast("Trip cancelled", "info");

      if (offlineAfterTrip) {
        setIsOnline(false);
        setOfflineAfterTrip(false);
        if (currentUser) updateDoc(doc(db, 'drivers', currentUser.uid), { isOnline: false });
      }
    } catch(err) { console.error("Could not cancel trip", err); addToast("Could not cancel trip", "error"); }
  };

  const verifyOTP = async () => {
    if (activeRequest && otpInput === activeRequest.otp) {
      const startTime = Date.now();
      await updateTripStatus(activeRequest.id, { status: 'InProgress', startTime });
      setDriverState('IN_PROGRESS');
      setOtpInput('');
      setShowChat(false);
      addToast("OTP Verified. Trip started!", "success");
    } else addToast("Invalid OTP. Please check with the client.", "error");
  };

  const completeTrip = async () => {
    if (activeRequest) {
      await updateTripStatus(activeRequest.id, { status: 'Completed' });
      setNotification(`Trip completed! ₹${activeRequest.fare} added to earnings.`);
      setDriverState('IDLE');
      setActiveRequest(null);
      setTimeout(() => setNotification(null), 5000);

      if (offlineAfterTrip) {
        setIsOnline(false);
        setOfflineAfterTrip(false);
        if (currentUser) updateDoc(doc(db, 'drivers', currentUser.uid), { isOnline: false });
      }

      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10B981', '#3B82F6', '#8B5CF6'],
          zIndex: 99999
        });
        confetti({
          particleCount: 5,
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
  };

  const notifyBreakdown = async () => {
    if(!activeRequest) return;
    setConfirmModal({
      title: "Vehicle Breakdown?",
      message: "This triggers a vehicle breakdown protocol affecting the client's car. Admin and Emergency Contacts will be alerted.",
      confirmText: "Confirm Breakdown",
      confirmStyle: "bg-amber-500/20 text-amber-500 border-amber-500/30",
      onConfirm: async () => {
        try {
          await updateTripStatus(activeRequest.id, { status: 'Disrupted' });

          const sosData = {
            tripId: activeRequest.id,
            userId: activeRequest.userId,
            driverId: currentUser.uid,
            timestamp: Date.now(),
            location: driverLocation,
            status: 'Active (Breakdown)',
            type: 'Breakdown'
          };
          await addDoc(collection(db, 'sosAlerts'), sosData);

          const emergencyEmail = profile?.emergencyEmail || profile?.emergencyContacts?.[0]?.email;
          if (emergencyEmail) {
            addToast("Sending breakdown alert to your emergency contact...", "info");
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/sos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                emergencyEmail,
                subject: `EMERGENCY ALERT: ${profile?.displayName || 'Driver'} reported a Breakdown!`,
                html: `<p><strong>EMERGENCY BREAKDOWN ALERT</strong></p>
                       <p>${profile?.displayName || 'Your contact'} has reported a vehicle breakdown during their trip.</p>
                       <p><strong>Trip ID:</strong> ${activeRequest.id}</p>
                       <p><strong>Status:</strong> Requires immediate attention.</p>`,
                userType: 'driver',
                userId: currentUser.uid,
                tripId: activeRequest.id,
                location: sosData.location
              })
            });
            if (response.ok) {
              addToast("Admin and Emergency Contact alerted via email. Stay with the user until help arrives. Fare will be prorated.", "error", 10000);
            } else {
               addToast("Breakdown logged to admin, but failed to email contact.", "warning");
            }
          } else {
            addToast("Breakdown Triggered. Admin notified. No emergency email found to alert.", "error", 10000);
          }

          setDriverState('IDLE');
          setActiveRequest(null);
        } catch(e) {
          console.error("Breakdown Trigger Error: ", e);
          addToast("Failed to trigger breakdown alert completely.", "error");
        }
      }
    });
  };

  const isMapVisible = driverState === 'EN_ROUTE' || driverState === 'IN_PROGRESS';

  const totalEarnings = pastTrips.reduce((acc, trip) => acc + Math.floor((trip.fare || 0) * 0.8), 0);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-text-muted font-medium animate-pulse">Loading Driver Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-background">
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
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
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="absolute pt-28 top-0 left-0 right-0 z-[60] flex justify-center pointer-events-none">
             <div className="bg-emerald-500 text-white px-6 py-3 rounded-full font-bold shadow-[0_10px_40px_rgba(16,185,129,0.3)] border border-emerald-400/50 flex items-center gap-2 text-sm">
                <span className="text-xl">💰</span> {notification}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`absolute inset-0 w-full overflow-hidden transition-opacity duration-700 ${isMapVisible ? 'opacity-100' : 'opacity-0'}`}>
        {isMapVisible && (
          <Map 
            pickupLocation={activeRequest ? activeRequest.pickupLocation : null}
            dropLocation={driverState === 'IN_PROGRESS' ? activeRequest?.dropLocation : null}
            status={driverState}
            driverLocation={driverLocation || (activeRequest ? { lat: activeRequest.pickupLocation.lat - 0.005, lng: activeRequest.pickupLocation.lng - 0.005 } : null)}
          />
        )}
      </div>
      
      {/* HUD */}
      <div className="absolute top-6 left-6 right-6 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-start pointer-events-auto">
          <div className="glass px-6 py-4 rounded-2xl flex items-center gap-4 border-black/10 dark:border-white/10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-blue-400 p-0.5">
              <div className="w-full h-full bg-surface rounded-full flex items-center justify-center text-text-main font-bold">
                {(driverProfile?.displayName || driverProfile?.fullName)?.substring(0, 2)?.toUpperCase() || 'DR'}
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Partner Status</p>
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                {getStatusText()}
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => navigate('/driver/profile')}
              className="flex items-center justify-center w-14 h-14 rounded-2xl font-bold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm text-text-muted hover:text-text-main"
              title="Profile"
            >
              <UserIcon size={20} />
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center w-14 h-14 rounded-2xl font-bold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm text-red-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
            <button 
              onClick={handleToggleOnline}
              className={`flex items-center gap-3 px-4 md:px-6 py-4 rounded-2xl font-bold transition-all shadow-xl ${
                driverState !== 'IDLE' && offlineAfterTrip 
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : isOnline 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                    : 'bg-emerald-500/10 dark:text-emerald-400 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              <Power /> <span className="hidden sm:inline">
                {driverState !== 'IDLE' ? (offlineAfterTrip ? 'CANCEL OFFLINE' : 'OFFLINE AFTER TRIP') : (isOnline ? 'GO OFFLINE' : 'GO ONLINE')}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className={`absolute z-40 px-4 md:px-0 pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${!isMapVisible
            ? 'inset-0 flex items-center justify-center bg-background border-none pt-20 pb-6' 
            : 'bottom-6 left-0 w-full md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 md:max-w-[420px]'
        }
      `}>
        <div className={`pointer-events-auto w-full transition-all duration-500 ${!isMapVisible ? 'max-w-[480px]' : 'max-w-[420px]'}`}>
        <AnimatePresence mode="wait">
          {driverState === 'IDLE' && (
            <motion.div layout key="idle" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className={`glass-card p-6 sm:p-8 text-center text-text-main ${!isMapVisible ? 'shadow-2xl border-white/5' : ''}`}>
              {isOnline ? (
                <>
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1">
                    <div className="absolute inset-0 border-[3px] border-emerald-500/30 rounded-full animate-ping" />
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full flex items-center justify-center backdrop-blur-md">
                      <MapPin className="text-emerald-500 w-5 h-5 animate-bounce" />
                    </div>
                  </div>
                  <h2 className="text-base font-bold mb-0.5">Scanning Area</h2>
                  <p className="text-[10px] sm:text-xs text-text-muted mb-2">Keep the app open to receive ride requests.</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center">
                    <Power className="text-text-muted w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold mb-0.5">You are Offline</h2>
                  <p className="text-[10px] sm:text-xs text-text-muted mb-2">Go online to start earning.</p>
                </>
              )}
              
              {/* Dashboard Navigation */}
              <div className="flex p-1 mt-2 mb-2 bg-black/10 dark:bg-black/40 rounded-xl ring-1 ring-black/5 dark:ring-white/5 relative w-full max-w-[240px] mx-auto">
                {['overview', 'earnings'].map((tab) => (
                  <button key={tab} onClick={() => setDashboardTab(tab)}
                    className={`flex-1 py-1 text-xs font-bold uppercase tracking-wider rounded-lg relative transition-colors duration-200 ${ dashboardTab === tab ? 'text-text-main' : 'text-text-muted' }`}
                  >
                    {dashboardTab === tab && <motion.div layoutId="driverTab" className="absolute inset-0 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm" />}
                    <span className="relative z-10">{tab === 'overview' ? 'Overview' : 'Past Earnings'}</span>
                  </button>
                ))}
              </div>

              {/* Dashboard Content */}
              <AnimatePresence mode="wait">
              {dashboardTab === 'overview' ? (
                <motion.div layout key="overview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-2 gap-2 text-left border-t border-black/5 dark:border-white/10 pt-2 w-full">
                    <div className="col-span-2 bg-black/5 dark:bg-black/40 p-2.5 sm:p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-inner flex justify-between items-center">
                       <div>
                          <p className="text-[9px] sm:text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Total Earnings</p>
                          <p className="text-lg sm:text-xl font-black text-emerald-500">₹{totalEarnings}</p>
                       </div>
                    </div>
                    
                    <div className="bg-black/5 dark:bg-black/40 p-2.5 sm:p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-inner text-center">
                        <p className="text-[9px] sm:text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Trips</p>
                        <p className="text-base sm:text-lg font-black text-text-main">{pastTrips.length}</p>
                    </div>
                    
                    <div className="bg-black/5 dark:bg-black/40 p-2.5 sm:p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-inner text-center">
                        <p className="text-[9px] sm:text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Distance</p>
                        <p className="text-base sm:text-lg font-black text-text-main">{driverProfile?.totalKm ? `${driverProfile.totalKm} km` : '0 km'}</p>
                    </div>
                    <div className="col-span-2 bg-black/5 dark:bg-black/40 p-2.5 sm:p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-inner flex justify-between items-center">
                       <div>
                          <p className="text-[9px] sm:text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Current Rating</p>
                          <p className="text-sm sm:text-base font-bold flex items-center gap-1 text-text-main">{driverProfile?.rating ? Number(driverProfile.rating).toFixed(1) : 'New'} <span className="text-amber-400 text-sm sm:text-base pb-0.5">★</span></p>
                       </div>
                       <div className="w-px h-6 sm:h-8 bg-black/10 dark:bg-white/10" />
                       <div className="text-right">
                          <p className="text-[9px] sm:text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Acceptance Rate</p>
                          <p className="text-sm sm:text-base font-bold text-emerald-500">{driverProfile?.acceptanceRate !== undefined ? driverProfile.acceptanceRate + '%' : 'New'}</p>
                       </div>
                    </div>
                </motion.div>
              ) : (
                <motion.div layout key="earnings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-left border-t border-black/5 dark:border-white/10 pt-3 max-h-48 overflow-y-auto pr-1 no-scrollbar w-full">
                  {loadingHistory ? (
                    <div className="space-y-2.5">
                      {[1, 2, 3].map(i => <div key={i} className="bg-black/5 dark:bg-white/5 h-16 rounded-xl animate-pulse" />)}
                    </div>
                  ) : pastTrips.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                       <div className="w-12 h-12 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <AlertTriangle className="w-6 h-6 text-text-muted" />
                       </div>
                       <p className="text-text-main font-bold text-sm">No completed trips</p>
                       <p className="text-text-muted text-xs">Your earnings will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pastTrips.map((trip, idx) => (
                        <div key={idx} className="bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-black/5 dark:border-white/5 shadow-inner flex justify-between items-center">
                          <div className="max-w-[160px]">
                            <p className="text-[10px] sm:text-xs text-text-muted font-bold uppercase truncate mb-0.5">{trip.dropLocation?.address || 'Trip'}</p>
                            <p className="text-xs sm:text-sm font-bold text-text-main truncate">Client: {trip.vehicleDetails?.type}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-500 font-black text-base sm:text-lg">₹{Math.floor((trip.fare || 0) * 0.8)}</p>
                            <p className="text-[9px] sm:text-[10px] text-text-muted">Total: ₹{trip.fare}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          )}

          {driverState === 'REQUEST_RECEIVED' && activeRequest && (
            <motion.div key="request" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card border-none ring-2 ring-primary overflow-hidden text-text-main shadow-2xl">
              <div className="px-4 pt-4 pb-3 text-center bg-gradient-to-b from-primary/10 to-transparent">
                <BellRing className="w-8 h-8 text-primary mx-auto mb-1 animate-bounce" />
                <h2 className="text-xl font-bold mb-1">New Request</h2>
                <div className="flex justify-center items-end gap-2 mb-2">
                  <span className="text-4xl font-black text-emerald-500">₹{activeRequest.fare}</span>
                  <span className="text-xs font-bold text-text-muted pb-1">Total Limit</span>
                </div>
                <div className="inline-block bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/30">
                   <p className="text-emerald-400 font-bold tracking-wider text-xs uppercase">Your Cut (80%): ₹{Math.floor(activeRequest.fare * 0.8)}</p>
                </div>
              </div>
              
              <div className="px-4 py-3 border-t border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div><h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Pickup</h4><p className="font-bold text-sm text-text-main leading-tight">{activeRequest.pickupLocation?.address}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Navigation className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div><h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Drop Location</h4><p className="font-bold text-xs italic text-text-muted">Revealed after OTP verification</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                   <div className="bg-black/10 dark:bg-black/40 p-2 rounded-lg border border-black/5 dark:border-white/5">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-0.5">Vehicle</p>
                      <p className="text-xs font-bold text-primary truncate">{activeRequest.vehicleDetails?.number} ({activeRequest.vehicleDetails?.type})</p>
                   </div>
                   <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider font-bold mb-0.5">Client Reason</p>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">{activeRequest.reason}</p>
                   </div>
                </div>
              </div>

              <div className="flex p-3 gap-3 bg-transparent">
                <button onClick={rejectRequest} className="flex-1 py-3 rounded-xl font-bold text-sm text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/10 flex items-center justify-center gap-2">
                  ✕ Reject
                </button>
                <button onClick={acceptRequest} className="flex-[2] py-3 rounded-xl font-bold text-base text-white bg-emerald-500 hover:bg-emerald-600 hover:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 relative overflow-hidden group border border-emerald-400/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <MapPin className="w-5 h-5 text-white/80" /> Accept Trip
                </button>
              </div>
            </motion.div>
          )}

          {driverState === 'EN_ROUTE' && activeRequest && (
            <motion.div key="enroute" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="glass-card overflow-hidden text-text-main">
              <div className="p-6 border-b border-black/5 dark:border-white/10 bg-primary/10 flex justify-between items-center">
                <div><h3 className="text-xl font-bold">Navigate to Pickup</h3><p className="text-text-muted text-sm mt-1 truncate max-w-[200px]">{activeRequest.pickupLocation?.address}</p></div>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center animate-pulse"><Navigation className="w-6 h-6 text-primary" /></div>
              </div>
              
              <div className="p-6 bg-surface">
                <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Enter Client OTP to Reveal Drop Location</label>
                <div className="flex flex-col gap-4">
                  <input type="text" className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-4 text-3xl tracking-[1em] text-center w-full focus:outline-none focus:border-primary font-mono text-text-main placeholder-text-muted/30 transition-all font-bold" 
                    value={otpInput} onChange={e => setOtpInput(e.target.value)} placeholder="0000" maxLength={4}/>
                  <div className="flex gap-2">
                    <button onClick={cancelTrip} className="flex-[1] bg-red-500/10 hover:bg-red-500/20 text-red-500 py-4 rounded-xl font-bold transition-all">Cancel</button>
                    <button onClick={verifyOTP} className="flex-[2] bg-emerald-500 hover:bg-emerald-600 py-4 rounded-xl font-bold text-white transition-colors duration-300">Verify & Start</button>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 font-medium mb-4">
                  OTP verification ensures you are at the correct location with the correct client/vehicle. Drop location unlocks automatically upon verification.
                </div>
                <button onClick={() => setShowChat(true)} className="w-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 py-4 rounded-xl font-bold transition-colors flex justify-center items-center gap-2">
                   Message User
                </button>
              </div>
            </motion.div>
          )}

          {driverState === 'IN_PROGRESS' && activeRequest && (
            <motion.div key="inprogress" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="glass-card p-6 border-l-4 border-l-emerald-500 text-text-main">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-emerald-500 text-xl font-bold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Driving Client Route
                  </h3>
                  <p className="text-text-muted text-sm mt-1">Trip time: {formatTime(tripTimer)}</p>
                </div>
                <div className="bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹{activeRequest.fare}</div>
              </div>

              <div className="bg-black/5 dark:bg-black/40 p-4 rounded-xl border border-black/5 dark:border-white/5 mb-6">
                 <p className="text-xs uppercase text-text-muted font-bold tracking-widest mb-2">Unlocked Drop Location</p>
                 <p className="font-bold flex items-start gap-2 text-lg">
                    <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    {activeRequest.dropLocation?.address}
                 </p>
              </div>

              <div className="flex gap-4 mb-6">
                <button onClick={notifyBreakdown} className="flex-1 py-3.5 rounded-xl font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all flex items-center justify-center gap-2"><ShieldAlert className="w-5 h-5" /> Vehicle Breakdown</button>
              </div>
              <button onClick={completeTrip} className="w-full bg-primary hover:bg-primary-hover py-4 rounded-xl font-bold text-lg text-white shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all">
                End Trip & Secure Payment
              </button>
            </motion.div>
          )}

        </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showChat && activeRequest && currentUser && (
          <Chat 
            tripId={activeRequest.id} 
            currentUser={currentUser} 
            onClose={() => setShowChat(false)} 
            isDriver={true} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
