import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Mail, User, Phone, Users, ShieldAlert, CreditCard, Camera } from 'lucide-react';
import { createUserProfile, createDriverProfile } from '../services/db';
import { useSignIn, useSignUp } from '@clerk/clerk-react';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initMode = searchParams.get('mode') === 'login' ? 'signin' : searchParams.get('mode') === 'driver' ? 'driver-signup' : 'user-signup';
  
  const [activeTab, setActiveTab] = useState(initMode);
  const [step, setStep] = useState(1);
  const { currentUser, clerkUser, fetchUserRole, setUserRole } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpInput, setOtpInput] = useState('');

  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const [formData, setFormData] = useState({
    email: '', password: '', newPassword: '', name: '', phone: '',
    emName: '', emRelation: '', emPhone: '',
    vType: 'Car', vNumber: '', vModel: '', vColor: '',
    consent: false,
    gender: 'Male', licenseNumber: '', licenseExpiry: '', licensePhoto: ''
  });

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
  const handleCheckbox = (e) => setFormData({...formData, [e.target.name]: e.target.checked});

  // Handle checking profile existence and navigating after login
  const handlePostAuthRouting = async (uid) => {
    const role = await fetchUserRole(uid);
    if (role === 'driver') navigate('/driver');
    else if (role === 'admin') navigate('/admin');
    else if (role === 'user') navigate('/user');
    else {
      // No profile found, user must complete onboarding
      if (activeTab === 'signin') setActiveTab('user-signup');
      setStep(3); // Skip email/otp steps
    }
  };

  // --- SUBMITS ---
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!isSignInLoaded) return;

    try {
      setError(''); setLoading(true);

      if (step === 1) {
        // Sign-in with email and password
        const completeSignIn = await signIn.create({
          identifier: formData.email,
          password: formData.password,
        });

        if (completeSignIn.status === 'complete') {
          await setSignInActive({ session: completeSignIn.createdSessionId });
        } else if (completeSignIn.status === 'needs_first_factor') {
          setError("Additional verification required. This is currently unsupported.");
        } else {
          setError(`Login incomplete. Status: ${completeSignIn.status}`);
        }
      } else if (step === 'forgot-1') {
        await signIn.create({
          strategy: 'reset_password_email_code',
          identifier: formData.email
        });
        setStep('forgot-2');
      } else if (step === 'forgot-2') {
        const result = await signIn.attemptFirstFactor({
          strategy: 'reset_password_email_code',
          code: otpInput,
          password: formData.newPassword
        });
        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId });
        } else {
          setError(`Password reset incomplete. Status: ${result.status}`);
        }
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.message);
    }
    setLoading(false);
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (!isSignUpLoaded) return;

    try {
      setError(''); setLoading(true);

      if (step === 1) {
        await signUp.create({
          emailAddress: formData.email,
          password: formData.password
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep(2);
      } else if (step === 2) {
        // Verify OTP
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: otpInput,
        });

        if (completeSignUp.status === 'complete') {
          await setSignUpActive({ session: completeSignUp.createdSessionId });
          // Move to profile details collection
          setStep(3);
        } else {
          console.error("SignUp incomplete:", completeSignUp);
          setError(`Incomplete verification step. Status: ${completeSignUp.status}. Missing requirements: ${completeSignUp.unverifiedFields?.join(', ') || completeSignUp.missingFields?.join(', ')}`);
        }
      } else {
        // Form continuation for User/Driver Details
        if (activeTab === 'user-signup' && step < 5) {
          setStep(step + 1);
          setLoading(false);
          return;
        }
        if (activeTab === 'driver-signup' && step < 4) {
          setStep(step + 1);
          setLoading(false);
          return;
        }

        // Final Submit: Create Firestore Profile
        if (!formData.consent) return setError("You must agree to the safety consent terms.");
        
        // At this point, Clerk is complete and we need currentUser from AuthContext (Firebase UID)
        if (!currentUser?.uid) {
           setError("Waiting for server authentication sync. Please try again in a few seconds.");
           setLoading(false);
           return;
        }

        const uid = currentUser.uid;

        if (activeTab === 'user-signup') {
          await createUserProfile(uid, {
            email: formData.email, displayName: formData.name, phoneNumber: formData.phone,
            emergencyContacts: [{ name: formData.emName, relation: formData.emRelation, phone: formData.emPhone, email: formData.emEmail }],
            vehicles: [{ type: formData.vType, number: formData.vNumber, model: formData.vModel, color: formData.vColor }],
            safetyConsent: formData.consent
          });
          setUserRole('user');
          navigate('/user');
        } else {
          await createDriverProfile(uid, {
            email: formData.email, displayName: formData.name, phoneNumber: formData.phone,
            gender: formData.gender, licenseNumber: formData.licenseNumber, licenseExpiry: formData.licenseExpiry, licensePhotoUrl: formData.licensePhoto,
            safetyConsent: formData.consent
          });
          setUserRole('driver');
          navigate('/driver');
        }
      }
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.message);
    }
    setLoading(false);
  };

  // Watch for Firebase currentUser to be ready
  const hasRoutedRef = useRef(false);
  useEffect(() => {
    if (currentUser?.uid && !hasRoutedRef.current) {
      hasRoutedRef.current = true;
      handlePostAuthRouting(currentUser.uid);
    }
  }, [currentUser]);

  const tabs = [
    { id: 'signin', label: 'Email Login' },
    { id: 'user-signup', label: 'User Sign Up' },
    { id: 'driver-signup', label: 'Partner Sign Up' }
  ];

  if (clerkUser && !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="glass-card p-8 flex flex-col items-center relative z-10 w-full max-w-md">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6 shadow-lg" />
          <h2 className="text-xl font-bold text-text-main mb-2">Synchronizing Profile</h2>
          <p className="text-sm text-text-muted text-center">Please wait while we securely connect your authentication provider to the platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 flex items-center justify-center px-4 sm:px-6 relative overflow-hidden bg-background">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000" />

      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card border-none ring-2 ring-primary shadow-2xl w-full max-w-md p-6 sm:p-8 relative z-10 max-h-[calc(100dvh-4rem)] overflow-y-auto no-scrollbar"
      >
        <div className="text-center mb-8">
          <Car size={40} className="mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold text-text-main mb-2">Welcome to Vroom</h1>
          {(step > 1 || typeof step === 'string') && (
            <p className="text-text-muted text-sm font-bold uppercase tracking-widest mt-2 hover:text-primary cursor-pointer" 
               onClick={() => {
                 if (step === 'forgot-1') setStep(1);
                 else if (step === 'forgot-2') setStep('forgot-1');
                 else setStep(prev => prev === 3 ? 1 : prev - 1);
               }}>
              ← Back
            </p>
          )}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">{error}</div>}

        {step === 1 && (
          <div className="flex p-1 mb-6 mt-2 bg-black/10 dark:bg-black/40 rounded-xl ring-1 ring-black/5 dark:ring-white/5 relative w-full max-w-sm mx-auto shadow-sm">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setStep(1); setOtpInput(''); }}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg relative transition-colors duration-200 ${ activeTab === tab.id ? 'text-text-main' : 'text-text-muted' }`}
              >
                {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute inset-0 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm" />}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUpSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key={activeTab} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4 w-full">
                {(activeTab === 'user-signup' || activeTab === 'driver-signup') && (
                  <>
                    <div className="relative"><User className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="name" type="text" placeholder="Full Name" value={formData.name} onChange={handleChange} required minLength={3} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                    <div className="relative"><Phone className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="phone" type="tel" pattern="[0-9]{10}" maxLength={10} title="Must be exactly 10 digits" placeholder="Mobile Number" value={formData.phone} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                  </>
                )}
                <div className="relative"><Mail className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative">
                  <ShieldAlert className="absolute left-4 top-3 text-text-muted h-5 w-5" />
                  <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required minLength={8} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" />
                </div>
                {(activeTab === 'user-signup' || activeTab === 'driver-signup') && formData.password && (
                  <div className="space-y-1 mt-1">
                    <div className="flex h-1 gap-1">
                      {[1, 2, 3, 4].map(level => {
                        const score = (formData.password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(formData.password) ? 1 : 0) + (/[0-9]/.test(formData.password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(formData.password) ? 1 : 0);
                        return <div key={level} className={`h-full flex-1 rounded-full transition-colors ${score >= level ? (score < 2 ? 'bg-red-500' : score < 4 ? 'bg-amber-400' : 'bg-green-500') : 'bg-black/10 dark:bg-white/10'}`} />
                      })}
                    </div>
                    <p className="text-[10px] text-right text-text-muted uppercase tracking-wider font-bold">
                      {['Weak', 'Fair', 'Good', 'Strong'][(formData.password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(formData.password) ? 1 : 0) + (/[0-9]/.test(formData.password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(formData.password) ? 1 : 0) - 1] || 'Weak'}
                    </p>
                  </div>
                )}
                {activeTab === 'signin' && (
                  <div className="text-right">
                    <button type="button" onClick={() => { setStep('forgot-1'); setError(''); }} className="text-sm text-primary hover:underline">Forgot Password?</button>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'forgot-1' && (
              <motion.div key="step-forgot-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">Reset Password</h3>
                <p className="text-sm text-text-muted mb-4">Enter your email to receive a password reset code.</p>
                <div className="relative"><Mail className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
              </motion.div>
            )}

            {step === 'forgot-2' && (
              <motion.div key="step-forgot-2" layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center w-full">
                <h3 className="text-xl font-bold flex flex-col items-center gap-2 text-text-main mb-2">
                  Verify Reset Code
                </h3>
                <p className="text-sm text-text-muted mb-6">Enter the 6-digit code sent to <span className="font-semibold text-text-main">{formData.email}</span>.</p>
                <input type="text" placeholder="------" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} maxLength={6} required className="w-full text-center text-3xl tracking-[0.5em] bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-4 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm font-semibold mb-4" />
                <div className="relative text-left">
                  <ShieldAlert className="absolute left-4 top-3 text-text-muted h-5 w-5" />
                  <input name="newPassword" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} required minLength={8} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2-otp" layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-center w-full">
                <h3 className="text-xl font-bold flex flex-col items-center gap-2 text-text-main mb-2">
                  <span className="bg-primary/20 p-4 rounded-full mb-2"><Mail className="text-primary h-8 w-8"/></span>
                  Verify Your Email
                </h3>
                <p className="text-sm text-text-muted mb-6">We've sent a 6-digit confirmation code to <span className="font-semibold text-text-main">{formData.email}</span>.</p>
                <input type="text" placeholder="------" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} maxLength={6} required className="w-full text-center text-3xl tracking-[0.5em] bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-4 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm font-semibold" />
                <button type="button" onClick={() => { setStep(1); setOtpInput(''); }} className="text-sm text-primary font-semibold hover:underline mt-4">Change Email Address</button>
              </motion.div>
            )}

            {step === 3 && activeTab === 'user-signup' && (
              <motion.div key="step3-user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main"><Users className="text-primary"/> Emergency Contact</h3>
                <p className="text-sm text-text-muted mb-4">Notified automatically for Medical/Drunk rides.</p>
                <div className="relative"><User className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="emName" type="text" placeholder="Contact Name" value={formData.emName} onChange={handleChange} required minLength={3} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative"><Users className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="emRelation" type="text" placeholder="Relationship (e.g. Brother, Spouse)" value={formData.emRelation} onChange={handleChange} required minLength={2} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative"><Phone className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="emPhone" type="tel" pattern="[0-9]{10}" maxLength={10} title="Must be exactly 10 digits" placeholder="Contact Phone" value={formData.emPhone} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative"><Mail className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="emEmail" type="email" placeholder="Contact Email (for SOS Alerts)" value={formData.emEmail} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
              </motion.div>
            )}

            {step === 4 && activeTab === 'user-signup' && (
              <motion.div key="step4-user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main"><Car className="text-primary"/> Vehicle Registration</h3>
                <p className="text-sm text-text-muted mb-4">MANDATORY: Details of the vehicle our partner will drive.</p>
                <select name="vType" value={formData.vType} onChange={handleChange} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm">
                  <option>Car</option><option>Bike</option>
                </select>
                <input name="vNumber" type="text" placeholder="Vehicle Number (e.g. MH01AB1234)" value={formData.vNumber} onChange={handleChange} required minLength={6} title="Enter a valid vehicle number" className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" />
                <input name="vModel" type="text" placeholder="Vehicle Model (Optional)" value={formData.vModel} onChange={handleChange} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" />
                <input name="vColor" type="text" placeholder="Vehicle Color (Optional)" value={formData.vColor} onChange={handleChange} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" />
              </motion.div>
            )}

            {step === 5 && activeTab === 'user-signup' && (
              <motion.div key="step5-user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main"><ShieldAlert className="text-primary"/> Safety Consent</h3>
                <label className="flex items-start gap-4 p-4 bg-primary/10 border border-primary/20 rounded-xl cursor-pointer">
                  <input name="consent" type="checkbox" checked={formData.consent} onChange={handleCheckbox} required className="mt-1 w-5 h-5 accent-primary" />
                  <span className="text-sm text-text-main font-medium">I authorize the assigned Vroom driver to operate my registered vehicle during the scheduled service. I understand this is mandatory for account activation.</span>
                </label>
              </motion.div>
            )}

            {step === 3 && activeTab === 'driver-signup' && (
              <motion.div key="step3-driver" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main"><CreditCard className="text-primary"/> Credentials</h3>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm">
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <div className="relative"><CreditCard className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="licenseNumber" type="text" placeholder="Driving License Number" value={formData.licenseNumber} onChange={handleChange} required minLength={5} title="License number must be at least 5 characters" className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative"><input name="licenseExpiry" type="date" placeholder="Expiry Date" value={formData.licenseExpiry} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 px-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
                <div className="relative"><Camera className="absolute left-4 top-3 text-text-muted h-5 w-5" /><input name="licensePhoto" type="url" placeholder="License Photo URL (Image Link)" value={formData.licensePhoto} onChange={handleChange} required className="w-full bg-white/60 dark:bg-black/40 border border-white/60 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-text-main outline-none focus:border-primary transition-all shadow-sm" /></div>
              </motion.div>
            )}

            {step === 4 && activeTab === 'driver-signup' && (
              <motion.div key="step4-driver" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main"><ShieldAlert className="text-primary"/> Professional Consent</h3>
                <label className="flex items-start gap-4 p-4 bg-primary/10 border border-primary/20 rounded-xl cursor-pointer">
                  <input name="consent" type="checkbox" checked={formData.consent} onChange={handleCheckbox} required className="mt-1 w-5 h-5 accent-primary" />
                  <span className="text-sm text-text-main font-medium">I agree to operate the user's vehicle responsibly and follow all safety guidelines during the trip. I understand violation restricts platform access.</span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg mt-6 relative overflow-hidden">
            {loading ? 'Processing...' : (
              activeTab === 'signin' ? (
                step === 1 ? 'Sign In' : 
                step === 'forgot-1' ? 'Send Reset Code' : 
                step === 'forgot-2' ? 'Reset Password' : 'Verify'
              ) : (
                step === (activeTab === 'user-signup' ? 5 : 4) ? 'Complete Registration' : 
                (step === 1 ? 'Next Step' : (step === 2 ? 'Verify Code' : 'Next Step'))
              )
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
