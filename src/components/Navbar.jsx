import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Car, Sun, Moon, User as UserIcon, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';
  const { theme, toggleTheme } = useTheme();
  const { currentUser, userRole, logout } = useAuth();

  const handleScroll = (e, id) => {
    if (location.pathname === '/') {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isLanding ? 'bg-transparent backdrop-blur-sm' : 'glass border-b border-black/5 dark:border-white/10'}`}>
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-primary/20 p-2 rounded-lg group-hover:bg-primary/40 transition-colors">
            <Car className="text-primary hover:text-primary-hover w-6 h-6 transition-colors duration-500" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-text-main transition-colors duration-500">Vroom</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 font-medium">
          <Link to="/#how-it-works" onClick={(e) => handleScroll(e, 'how-it-works')} className="text-text-muted hover:text-text-main transition-colors duration-500">How it Works</Link>
          <Link to="/#safety" onClick={(e) => handleScroll(e, 'safety')} className="text-text-muted hover:text-text-main transition-colors duration-500">Safety</Link>
          <Link to="/#pricing" onClick={(e) => handleScroll(e, 'pricing')} className="text-text-muted hover:text-text-main transition-colors duration-500">Pricing</Link>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10 text-text-main hover:bg-black/10 dark:hover:bg-white/20 transition-all duration-500 relative overflow-hidden"
            aria-label="Toggle Theme"
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.div
                  key="sun"
                  initial={{ y: -30, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 30, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="absolute"
                >
                  <Sun size={20} className="text-amber-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ y: -30, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 30, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="absolute"
                >
                  <Moon size={20} className="text-indigo-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {currentUser ? (
            <>
              <Link to={userRole === 'admin' ? '/admin' : `/${userRole || 'user'}`} className="hidden sm:block text-text-muted hover:text-text-main font-medium transition-colors duration-500">
                Dashboard
              </Link>
              <Link to={`/${userRole || 'user'}/profile`} className="hidden sm:flex items-center gap-1.5 text-text-muted hover:text-text-main font-medium transition-colors duration-500">
                <UserIcon size={18} /> Profile
              </Link>
              <button onClick={handleLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full font-semibold transition-all flex items-center gap-1.5">
                <LogOut size={18} /> <span className="hidden sm:inline">Log Out</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/auth?mode=login" className="hidden sm:block text-text-muted hover:text-text-main font-medium transition-colors duration-500">
                Log In
              </Link>
              <Link to="/auth?mode=user" className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-primary/20 transition-all">
                Book a Driver
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
