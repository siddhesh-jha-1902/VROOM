import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    emergencyName: '',
    emergencyContact: '',
    vehicleType: 'Car',
    vehicleMake: '',
    vehicleModel: '',
    vehicleColor: '',
    vehicleNumber: '',
    emergencyEmail: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser || !userRole) return;
      
      try {
        const collectionName = userRole === 'driver' ? 'drivers' : 'users';
        const userDoc = await getDoc(doc(db, collectionName, currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData({
            displayName: data.displayName || '',
            phone: data.phoneNumber || data.phone || '',
            emergencyName: data.emergencyContacts?.[0]?.name || data.emergencyName || '',
            emergencyContact: data.emergencyContacts?.[0]?.phone || data.emergencyContact || '',
            vehicleType: data.vehicles?.[0]?.type || data.vehicle?.type || 'Car',
            vehicleMake: data.vehicles?.[0]?.make || data.vehicle?.make || '',
            vehicleModel: data.vehicles?.[0]?.model || data.vehicle?.model || '',
            vehicleColor: data.vehicles?.[0]?.color || data.vehicle?.color || '',
            vehicleNumber: data.vehicles?.[0]?.number || data.vehicle?.plate || data.vehicle?.number || '',
            emergencyEmail: data.emergencyContacts?.[0]?.email || data.emergencyEmail || ''
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser, userRole]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // Validation
      if (!formData.displayName.trim() || !formData.phone.trim()) {
        throw new Error("Name and Phone are required.");
      }
      if (formData.phone.length < 10) {
        throw new Error("Phone number must be at least 10 digits.");
      }

      const collectionName = userRole === 'driver' ? 'drivers' : 'users';
      const docRef = doc(db, collectionName, currentUser.uid);
      
      const updatePayload = {
        displayName: formData.displayName,
        phoneNumber: formData.phone // Unified phone field
      };

      if (userRole === 'user' || userRole === 'admin') {
        if (formData.emergencyContact && formData.emergencyContact.length < 10) {
           throw new Error("Emergency contact must be at least 10 digits.");
        }
        updatePayload.emergencyContact = formData.emergencyContact;
        
        const userDocData = (await getDoc(docRef)).data() || {};
        let emergencyContacts = userDocData.emergencyContacts || [{}];
        emergencyContacts[0] = { 
          ...emergencyContacts[0], 
          name: formData.emergencyName || 'Emergency Contact',
          phone: formData.emergencyContact,
          email: formData.emergencyEmail
        };
        updatePayload.emergencyContacts = emergencyContacts;
        updatePayload.emergencyEmail = formData.emergencyEmail;
      }

      // Both users and drivers can have vehicles, but not admins
      if (userRole !== 'admin') {
        const newVehicle = {
          type: formData.vehicleType,
          make: formData.vehicleMake,
          model: formData.vehicleModel,
          color: formData.vehicleColor,
          number: formData.vehicleNumber,
          plate: formData.vehicleNumber // for legacy compatibility
        };
        updatePayload.vehicles = [newVehicle];
        updatePayload.vehicle = newVehicle;
      }

      await updateDoc(docRef, updatePayload);
      setSuccess(true);
      
      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex flex-col items-center bg-background">
        <div className="w-full max-w-2xl glass-card rounded-3xl p-8 border border-white/10 shadow-2xl animate-pulse">
          <div className="flex justify-between items-center mb-8">
            <div className="h-10 w-48 bg-black/10 dark:bg-white/10 rounded-xl"></div>
            <div className="h-10 w-24 bg-black/10 dark:bg-white/10 rounded-xl"></div>
          </div>
          <div className="mb-8 flex items-center space-x-4">
            <div className="h-16 w-16 bg-black/10 dark:bg-white/10 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 w-48 bg-black/10 dark:bg-white/10 rounded-md"></div>
              <div className="h-4 w-24 bg-black/10 dark:bg-white/10 rounded-full"></div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-6 w-40 bg-black/10 dark:bg-white/10 rounded-md mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-14 bg-black/10 dark:bg-white/10 rounded-xl"></div>
              <div className="h-14 bg-black/10 dark:bg-white/10 rounded-xl"></div>
              <div className="h-14 bg-black/10 dark:bg-white/10 rounded-xl"></div>
              <div className="h-14 bg-black/10 dark:bg-white/10 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex flex-col items-center bg-background transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl glass-card rounded-3xl p-8 backdrop-blur-xl border border-white/10 dark:border-white/5 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-text-main md:text-5xl tracking-tight">
            My <span className="text-primary">Profile</span>
          </h1>
          
          <button
            onClick={() => {
              navigate(userRole === 'driver' ? '/driver' : userRole === 'admin' ? '/admin' : '/user');
            }}
            className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-xl mb-6 text-sm font-medium border border-red-500/20">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/10 text-green-500 p-4 rounded-xl mb-6 text-sm font-medium border border-green-500/20">
            Profile updated successfully!
          </div>
        )}

        <div className="mb-8 flex items-center space-x-4">
          <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center text-2xl font-black">
            {formData.displayName.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-xl font-bold text-text-main">{currentUser.email}</p>
            <span className="inline-block mt-1 px-3 py-1 bg-black/5 dark:bg-white/5 text-text-muted rounded-full text-xs font-bold uppercase tracking-wider">
              {userRole}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b border-black/5 dark:border-white/5 pb-2 text-text-main">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-muted">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="displayName"
                  required
                  value={formData.displayName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-muted">Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  name="phone"
                  required
                  minLength={10}
                  maxLength={15}
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                />
              </div>
            </div>

            {(userRole === 'user' || userRole === 'admin') && (
              <>
                <div className="space-y-2 pt-2">
                  <label className="text-sm font-semibold text-text-muted">Emergency Contact Name</label>
                  <input
                    type="text"
                    name="emergencyName"
                    value={formData.emergencyName}
                    onChange={handleChange}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    placeholder="Optional"
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                  <p className="text-xs text-text-muted">We will share your live trip details with this contact if SOS is triggered.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Emergency Contact Email</label>
                  <input
                    type="email"
                    name="emergencyEmail"
                    value={formData.emergencyEmail}
                    onChange={handleChange}
                    placeholder="e.g. emergency@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                  <p className="text-xs text-text-muted">Used to send email SOS alerts via Resend.</p>
                </div>
              </>
            )}
          </div>

          {userRole === 'user' && (
            <div className="space-y-4 pt-4 mt-8 border-t border-black/5 dark:border-white/5">
              <h3 className="text-lg font-bold text-text-main pb-2">
                Vehicle Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Vehicle Type <span className="text-red-500">*</span></label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  >
                    <option value="Car">Car</option>
                    <option value="SUV">SUV</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Bike">Bike</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">License Plate / Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="vehicleNumber"
                    required
                    placeholder="e.g. AB 12 CD 3456"
                    value={formData.vehicleNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all uppercase text-text-main"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Vehicle Make</label>
                  <input
                    type="text"
                    name="vehicleMake"
                    placeholder="e.g. Honda, Hyundai"
                    value={formData.vehicleMake}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Model (Optional)</label>
                  <input
                    type="text"
                    name="vehicleModel"
                    placeholder="e.g. City, i20"
                    value={formData.vehicleModel}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-muted">Color (Optional)</label>
                  <input
                    type="text"
                    name="vehicleColor"
                    placeholder="e.g. White, Black"
                    value={formData.vehicleColor}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary focus:bg-transparent outline-none transition-all text-text-main"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="w-full md:w-auto px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors"
            >
              Sign Out
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className={`w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/20 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
