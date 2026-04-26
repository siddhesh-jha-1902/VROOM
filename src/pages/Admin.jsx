import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ShieldCheck, Activity, Search, AlertTriangle, CheckCircle, Car, Map as MapIcon, Link, MapPin, Navigation, LogOut } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [supportNotification, setSupportNotification] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), snapshot => setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snapshot => setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubTrips = onSnapshot(query(collection(db, 'trips')), snapshot => setTrips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubSos = onSnapshot(query(collection(db, 'sosAlerts')), snapshot => setSosAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => { unsubDrivers(); unsubUsers(); unsubTrips(); unsubSos(); };
  }, []);

  const handleApproveDriver = async (id) => updateDoc(doc(db, 'drivers', id), { status: 'Approved' });
  const handleRejectDriver = async (id) => updateDoc(doc(db, 'drivers', id), { status: 'Rejected' });

  const activeTripsCount = trips.filter(t => t.status === 'InProgress' || t.status === 'Assigned').length;
  const onlineDriversCount = drivers.filter(d => d.isOnline).length;
  
  const combinedAlerts = [
    ...trips.filter(t => t.status === 'Disrupted' || t.status === 'Emergency').map(t => ({...t, type: 'TripAlert'})),
    ...sosAlerts.filter(a => a.status === 'Active').map(a => ({...a, type: 'SOSAlert'}))
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-text-main overflow-hidden transition-colors duration-500">
      <div className="w-full md:w-72 flex-none bg-black/5 dark:bg-black/40 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/5 flex flex-col relative z-20">
        <div className="hidden md:block p-8 border-b border-black/10 dark:border-white/5">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
            <h2 className="text-xl font-bold tracking-tight text-text-main">Global Command</h2>
          </div>
          <p className="text-xs text-text-muted uppercase tracking-widest font-bold">Admin Privileges</p>
        </div>
        
        <nav className="flex overflow-x-auto md:flex-col md:flex-1 p-3 md:p-4 gap-2 md:space-y-2 no-scrollbar md:border-none">
          {[
            { id: 'overview', icon: <Activity size={20} />, label: 'Overview' },
            { id: 'drivers', icon: <ShieldCheck size={20} />, label: 'Partners' },
            { id: 'users', icon: <Users size={20} />, label: 'Users' },
            { id: 'trips', icon: <MapIcon size={20} />, label: 'Audits' },
            { id: 'profile', icon: <Link size={20} />, label: 'My Profile', action: () => navigate('/admin/profile') }
          ].map(tab => (
            <button key={tab.id} onClick={() => tab.action ? tab.action() : setActiveTab(tab.id)}
              className={`flex-shrink-0 md:w-full flex items-center gap-2 px-4 py-2 md:py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id && !tab.action ? 'bg-primary/20 text-primary border border-primary/30' : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main border border-transparent'
              }`}
            >
              <div className={activeTab === tab.id && !tab.action ? 'animate-pulse' : ''}>{tab.icon}</div>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
          
          <button onClick={handleLogout} className="md:hidden flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-bold transition-colors uppercase tracking-widest text-[10px] ml-auto relative">
            <LogOut size={16} /> Logout
          </button>
        </nav>
        
        <div className="hidden md:block p-4 mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-bold transition-colors uppercase tracking-widest text-xs">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative z-10 bg-background p-4 md:p-8 no-scrollbar">
        <AnimatePresence>
          {supportNotification && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-24 left-0 right-0 z-[60] flex justify-center pointer-events-none">
               <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold shadow-[0_10px_40px_rgba(239,68,68,0.3)] border border-red-400/50 flex items-center gap-2 text-sm">
                  <ShieldAlert size={20} /> {supportNotification}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                <div><h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Network Status</h2><p className="text-sm md:text-base text-text-muted">Real-time telemetry and fleet metrics.</p></div>
                {combinedAlerts.length > 0 && <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-4 py-2 rounded-full border border-red-500/20 animate-pulse font-bold text-sm"><AlertTriangle size={16} /> {combinedAlerts.length} Critical Alerts</div>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
                <div className="glass-card p-6 border-t-2 border-t-primary">
                  <h3 className="text-4xl font-black text-text-main mb-2">{activeTripsCount}</h3>
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Active Trips</p>
                </div>
                <div className="glass-card p-6 border-t-2 border-t-emerald-500">
                  <h3 className="text-4xl font-black text-text-main mb-2">{onlineDriversCount}</h3>
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Partners Online</p>
                </div>
                <div className="glass-card p-6 border-t-2 border-t-[#8b5cf6]">
                  <h3 className="text-4xl font-black text-[#8b5cf6] mb-2">
                    ₹{trips.filter(t => t.status === 'Completed').reduce((acc, curr) => acc + (curr.fare || 0), 0)}
                  </h3>
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Total Earnings</p>
                </div>
                <div className={`glass-card p-6 border-t-2 ${combinedAlerts.length > 0 ? 'border-t-red-500 animate-pulse' : 'border-t-black/10 dark:border-t-white/10'}`}>
                  <h3 className={`text-4xl font-black mb-2 ${combinedAlerts.length > 0 ? 'text-red-500' : 'text-text-main'}`}>{combinedAlerts.length}</h3>
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">Disruptions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                <div className="glass-card p-6 border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">Platform Revenue (20% Cut)</h3>
                  <div className="flex items-end gap-3">
                     <span className="text-5xl font-black text-emerald-500">₹{Math.floor(trips.filter(t => t.status === 'Completed').reduce((acc, curr) => acc + (curr.fare || 0), 0) * 0.2)}</span>
                     <span className="text-text-muted font-bold mb-1">Lifetime</span>
                  </div>
                </div>
                <div className="glass-card p-6 border border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-muted mb-4">User Acquisition</h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-4xl font-black text-text-main">{users.length}</p>
                      <p className="text-xs text-text-muted font-bold uppercase mt-1">Total Users</p>
                    </div>
                    <div className="h-10 w-px bg-black/10 dark:bg-white/10" />
                    <div className="text-right">
                      <p className="text-4xl font-black text-primary">{drivers.length}</p>
                      <p className="text-xs text-text-muted font-bold uppercase mt-1">Total Partners</p>
                    </div>
                  </div>
                </div>
              </div>

              {combinedAlerts.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-red-500 font-bold uppercase tracking-widest text-sm mb-4">Urgent Attention Needed</h3>
                  {combinedAlerts.map(alert => (
                    <div key={alert.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4">
                      <div className="p-3 bg-red-500/20 rounded-xl text-red-600 dark:text-red-500 mt-1"><AlertTriangle size={24} /></div>
                      <div>
                        {alert.type === 'TripAlert' ? (
                          <>
                            <h4 className="text-red-600 dark:text-red-500 font-bold text-lg mb-1">{alert.status === 'Disrupted' ? 'Vehicle Breakdown' : 'SOS Emergency'} - Trip {alert.id.slice(-4)}</h4>
                            <p className="text-red-800 dark:text-red-200/70 text-sm font-medium">Driver {alert.driverName} reported an incident with User's {alert.vehicleDetails?.type} ({alert.vehicleDetails?.number}). Last known route to <strong className="text-text-main">{alert.pickupLocation?.address}</strong>.</p>
                            <div className="mt-4 flex gap-3">
                              <button onClick={() => {
                                updateDoc(doc(db, 'trips', alert.id), { supportDispatched: true });
                                setSupportNotification("Support Team Dispatched! They are on their way to the location.");
                                setTimeout(() => setSupportNotification(''), 5000);
                              }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors" disabled={alert.supportDispatched}>
                                {alert.supportDispatched ? 'Support En Route' : 'Dispatch Support team'}
                              </button>
                              <button onClick={() => updateDoc(doc(db, 'trips', alert.id), { status: 'Resolved' })} className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main px-4 py-2 rounded-lg text-sm font-bold transition-colors">Mark Resolved</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="text-red-600 dark:text-red-500 font-bold text-lg mb-1">🆘 IMMEDIATE SOS ACTIVATED</h4>
                            <p className="text-red-800 dark:text-red-200/70 text-sm font-medium">Trip: {alert.tripId?.slice(-4)} | User Phone: <a href={`tel:${alert.userPhone}`} className="underline">{alert.userPhone}</a></p>
                            <p className="text-red-800 dark:text-red-200/70 text-sm font-medium mt-1">Location: {alert.location?.address || `Lat: ${alert.location?.lat}, Lng: ${alert.location?.lng}`}</p>
                            <div className="mt-4 flex gap-3">
                              <button onClick={() => {
                                updateDoc(doc(db, 'sosAlerts', alert.id), { supportDispatched: true });
                                window.location.href = 'tel:112';
                              }} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-red-500/20" disabled={alert.supportDispatched}>
                                {alert.supportDispatched ? 'Authorities Contacted' : 'Call Police / Ambulance'}
                              </button>
                              <button onClick={() => updateDoc(doc(db, 'sosAlerts', alert.id), { status: 'Resolved' })} className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main px-4 py-2 rounded-lg text-sm font-bold transition-colors">Mark Resolved</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Live Activity Feed */}
              <div className="mt-8 glass-card p-6 border-t-4 border-t-primary/50">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Activity size={20} className="text-primary"/> Live Activity Feed</h3>
                 <div className="relative pl-4 border-l-2 border-black/10 dark:border-white/10 space-y-6">
                    {trips.slice().reverse().slice(0, 10).map((t, idx) => (
                       <div key={t.id} className="relative">
                          <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full ring-4 ring-background bg-primary" />
                          <p className="text-sm text-text-main font-medium">Trip <span className="font-mono bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded text-xs">...{t.id.slice(-6)}</span> status: <span className={`font-bold ${t.status === 'Completed' ? 'text-emerald-500' : t.status === 'Cancelled' ? 'text-red-500' : 'text-primary'}`}>{t.status}</span></p>
                          <div className="flex gap-4 mt-1">
                            <p className="text-xs text-text-muted flex items-center gap-1"><Car size={12}/> {t.driverName || 'Finding Partner'}</p>
                            <p className="text-xs text-text-muted flex items-center gap-1"><MapPin size={12}/> {t.pickupLocation?.address ? t.pickupLocation.address.split(',')[0] : 'Unknown Location'}</p>
                          </div>
                       </div>
                    ))}
                    {trips.length === 0 && <p className="text-text-muted text-sm pb-2">No recent activity detected on the network.</p>}
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'drivers' && (
            <motion.div key="drivers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                <div><h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Partner Licensing</h2><p className="text-sm md:text-base text-text-muted">Review credentials and activate partner access.</p></div>
                <div className="relative w-full md:w-auto"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted h-5 w-5" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search partners..." className="bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl py-2 pl-12 pr-4 text-text-main focus:outline-none focus:border-primary w-full md:w-64" /></div>
              </div>

              <div className="glass-card overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Partner Details</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">License Info</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Status</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredDrivers = drivers.filter(d => (d.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || (d.phoneNumber || '').includes(searchQuery));
                      if (filteredDrivers.length === 0) {
                        return (
                          <tr>
                            <td colSpan="4" className="p-8 text-center text-text-muted">
                              <div className="flex flex-col items-center justify-center py-6">
                                <ShieldCheck className="w-12 h-12 mb-3 text-black/20 dark:text-white/20" />
                                <p className="font-bold text-lg text-text-main mb-1">No Partners Found</p>
                                <p className="text-sm">There are currently no partners matching your criteria.</p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return filteredDrivers.map(d => (
                        <tr key={d.id} className="border-b border-black/5 dark:border-white/5">
                          <td className="p-6">
                            <div className="font-bold text-text-main">{d.displayName || 'Unnamed Partner'}</div>
                            <div className="text-sm text-text-muted mt-1">{d.email} • {d.phoneNumber}</div>
                          </td>
                          <td className="p-6">
                             <div className="text-sm font-bold text-primary">{d.licenseNumber || 'Not provided'}</div>
                             <div className="text-xs text-text-muted mt-1 tracking-wider">EXP: {d.licenseExpiry || 'N/A'}</div>
                             <a href={d.licensePhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">View Document</a>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${d.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : d.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                              {d.status || 'Pending'}
                            </span>
                          </td>
                          <td className="p-6">
                            {(!d.status || d.status === 'Pending') ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleApproveDriver(d.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Approve</button>
                                <button onClick={() => handleRejectDriver(d.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-xs font-bold border border-red-500/20">Reject</button>
                              </div>
                            ) : d.status === 'Approved' ? (
                              <div className="text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-1"><CheckCircle size={16}/> Cleared</div>
                            ) : <div className="text-red-500 text-sm font-bold">Denied</div>}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
             <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                  <div><h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">User Directory</h2><p className="text-sm md:text-base text-text-muted">Client profiles and registered vehicles.</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {users.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 glass-card p-12 text-center text-text-muted">
                      <Users className="w-12 h-12 mx-auto mb-3 text-black/20 dark:text-white/20" />
                      <p className="font-bold text-lg text-text-main mb-1">No Users Registered</p>
                      <p className="text-sm">There are no client profiles in the directory yet.</p>
                    </div>
                  ) : (
                    users.map(u => (
                       <div key={u.id} className="glass-card p-6">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <h3 className="font-bold text-lg text-text-main">{u.displayName}</h3>
                                <p className="text-sm text-text-muted">{u.email} • {u.phoneNumber}</p>
                             </div>
                             <span className="bg-blue-500/10 text-primary px-3 py-1 rounded-full text-xs font-bold">Client</span>
                          </div>
                          <div className="border-t border-black/5 dark:border-white/5 pt-4 grid grid-cols-2 gap-4">
                             <div>
                                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Primary Vehicle</p>
                                <p className="text-sm font-bold">{u.vehicles?.[0]?.type || 'N/A'}</p>
                                <p className="text-xs text-text-muted">{u.vehicles?.[0]?.number || 'Unregistered'}</p>
                             </div>
                             <div>
                                <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Emergency Contact</p>
                                <p className="text-sm font-bold">{u.emergencyContacts?.[0]?.name || 'N/A'}</p>
                                <p className="text-xs text-text-muted">{u.emergencyContacts?.[0]?.phone}</p>
                             </div>
                          </div>
                       </div>
                    ))
                  )}
                </div>
             </motion.div>
          )}

          {activeTab === 'trips' && (
            <motion.div key="trips" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 md:mb-8 gap-4">
                <div><h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Network Audits</h2><p className="text-sm md:text-base text-text-muted">Historical logs and active trip monitoring.</p></div>
              </div>

              <div className="glass-card overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10">
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Trip Trace</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Details</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Fare</th>
                      <th className="p-6 text-xs font-bold uppercase tracking-widest text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-text-muted">
                          <div className="flex flex-col items-center justify-center py-6">
                            <MapIcon className="w-12 h-12 mb-3 text-black/20 dark:text-white/20" />
                            <p className="font-bold text-lg text-text-main mb-1">No Audits Found</p>
                            <p className="text-sm">There are no historical logs or active trips.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      trips.map(t => (
                        <tr key={t.id} className="border-b border-black/5 dark:border-white/5 text-sm">
                          <td className="p-6 font-mono text-text-muted">
                             <div className="font-bold">...{t.id.slice(-6)}</div>
                             <div className="text-[10px] uppercase mt-1">Driver: {t.driverName || 'N/A'}</div>
                          </td>
                          <td className="p-6 text-text-main">
                             <div className="font-bold flex items-center gap-2 mb-1"><MapPin size={14} className="text-emerald-500" /> {t.pickupLocation?.address || 'Start'}</div>
                             <div className="text-text-muted flex items-center gap-2"><Navigation size={14} /> {t.dropLocation?.address || 'End'}</div>
                             <div className="mt-2 inline-flex border border-black/10 dark:border-white/10 px-2 py-1 rounded bg-black/5 dark:bg-white/5 text-xs text-text-muted">{t.reason}</div>
                          </td>
                          <td className="p-6 font-bold text-emerald-500">₹{t.fare}</td>
                          <td className="p-6">
                            <span className={`font-bold ${
                              t.status === 'Completed' ? 'text-text-muted' : 
                              (t.status === 'Disrupted' || t.status === 'Emergency') ? 'text-red-500' : 'text-primary'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
