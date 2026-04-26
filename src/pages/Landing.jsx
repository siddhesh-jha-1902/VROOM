import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Car, Clock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { getPlatformStats } from '../services/db';

const Landing = () => {
  const { addToast } = useToast();
  const [stats, setStats] = useState({ rides: "...", drivers: "..." });

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getPlatformStats();
      // Format with commas, showing exact real-time number
      setStats({
        rides: data.totalTrips.toLocaleString(),
        drivers: data.totalDrivers.toLocaleString()
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[120px]" />

      {/* Hero Section */}
      <main id="how-it-works" className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Safe rides home in <br/>
            <span className="text-gradient">your own car.</span>
          </h1>
          <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
            We drive your car so you don't have to. Let our trusted, vetted professional drivers ensure you and your vehicle arrive home safely and securely.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=user" className="glass px-8 py-4 rounded-full font-semibold hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2 group shadow-sm">
              Book a Driver
              <motion.span className="group-hover:translate-x-1 transition-transform">→</motion.span>
            </Link>
            <Link to="/auth?mode=driver" className="px-8 py-4 rounded-full font-semibold border border-text-main/20 hover:bg-text-main/5 dark:border-white/20 dark:hover:bg-white/5 transition-all">
              Become a Driver
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Features Section */}
      <section id="safety" className="relative z-10 py-20 px-6 max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
        {[
          { icon: <Shield className="w-8 h-8 text-blue-400" />, title: "Professional Drivers", desc: "Fully vetted, background-checked, and experienced drivers." },
          { icon: <Car className="w-8 h-8 text-emerald-400" />, title: "Your Car, Your Comfort", desc: "Enjoy the ride in the comfort of your own vehicle." },
          { icon: <Clock className="w-8 h-8 text-amber-400" />, title: "Instant Booking", desc: "Request a driver in seconds and get moving without delay." }
        ].map((feature, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.2 }}
            className="glass-card p-8 flex flex-col items-center text-center"
          >
            <div className="p-4 bg-white/60 dark:bg-white/5 shadow-sm dark:shadow-none rounded-full mb-6">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
            <p className="text-text-muted">{feature.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Stats Counter Section */}
      <section className="relative z-10 py-16 bg-black/5 dark:bg-white/5 border-y border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: stats.rides, label: "Rides Completed" },
            { value: stats.drivers, label: "Verified Drivers" },
            { value: "4.9", label: "Average Rating", star: true },
            { value: "24/7", label: "Support Available" }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, type: "spring" }}
            >
              <div className="text-4xl md:text-5xl font-black text-primary mb-2 flex items-center justify-center gap-1">
                {stat.value}
                {stat.star && <span className="text-2xl text-amber-400">★</span>}
              </div>
              <div className="text-text-muted font-medium uppercase tracking-wider text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials Section Removed as it contained mock data */}

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-20 px-6 max-w-7xl mx-auto text-center">
         <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Transparent Pricing</h2>
         <p className="text-xl text-text-muted mb-12 max-w-2xl mx-auto">No hidden fees or surge pricing. Just reliable, professional service.</p>
         <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-card p-10 flex flex-col items-center border-t-2 border-t-emerald-500 hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-black/5 dark:shadow-white/5">
               <h3 className="text-2xl font-bold mb-2">Standard Ride</h3>
               <div className="text-5xl font-black text-emerald-500 mb-6">₹50 <span className="text-lg text-text-muted font-normal">/ base + ₹15/km</span></div>
               <p className="text-text-muted mb-8">Professional driver for your personal vehicle. Safe, reliable, and convenient.</p>
               <Link to="/auth" className="w-full inline-block text-center bg-white/60 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10 text-text-main py-4 rounded-xl font-bold transition-all shadow-sm">Book Now</Link>
            </div>
            <div className="glass-card p-10 flex flex-col items-center border-t-2 border-t-[#8b5cf6] relative overflow-hidden hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-[#8b5cf6]/10">
               <div className="absolute top-4 right-4 bg-[#8b5cf6]/20 text-[#8b5cf6] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Coming Soon</div>
               <h3 className="text-2xl font-bold mb-2">Night Out Package</h3>
               <div className="text-5xl font-black text-[#8b5cf6] mb-6">₹1499 <span className="text-lg text-text-muted font-normal">/ 4 hours</span></div>
               <p className="text-text-muted mb-8">Dedicated driver on standby for the entire evening. Multiple stops included.</p>
               <button onClick={() => addToast("Night Out Package is coming soon!", "info")} className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-4 rounded-xl font-bold shadow-lg shadow-[#8b5cf6]/20 transition-all">Select Package</button>
            </div>
         </div>
      </section>
    </div>
  );
};

export default Landing;
