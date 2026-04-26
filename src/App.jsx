import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Landing from './pages/Landing';
import UserApp from './pages/UserApp';
import DriverApp from './pages/DriverApp';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './contexts/ToastContext';

const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="min-h-[calc(100vh-6rem)]"
  >
    {children}
  </motion.div>
);

function AppContent() {
  const location = useLocation();
  const showNavAndFooter = location.pathname === '/';
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-main">
      {showNavAndFooter && <Navbar />}
      <main className="flex-grow relative overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageWrapper><Landing /></PageWrapper>} />
            <Route path="/auth" element={<PageWrapper><Auth /></PageWrapper>} />
            
            <Route path="/user" element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <PageWrapper><UserApp /></PageWrapper>
              </ProtectedRoute>
            } />
            <Route path="/user/profile" element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <PageWrapper><Profile /></PageWrapper>
              </ProtectedRoute>
            } />
            
            <Route path="/driver" element={
              <ProtectedRoute allowedRoles={['driver', 'admin']}>
                <PageWrapper><DriverApp /></PageWrapper>
              </ProtectedRoute>
            } />
            <Route path="/driver/profile" element={
              <ProtectedRoute allowedRoles={['driver', 'admin']}>
                <PageWrapper><Profile /></PageWrapper>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/profile" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageWrapper><Profile /></PageWrapper>
              </ProtectedRoute>
            } />
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PageWrapper><Admin /></PageWrapper>
              </ProtectedRoute>
            } />
            
            {/* 404 Route */}
            <Route path="*" element={
              <PageWrapper>
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                  <h1 className="text-6xl font-black text-primary mb-4">404</h1>
                  <h2 className="text-2xl font-bold mb-6 text-text-main">Page Not Found</h2>
                  <p className="text-text-muted mb-8 max-w-md">The page you are looking for doesn't exist or has been moved.</p>
                  <Link to="/" className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/20">
                    Return Home
                  </Link>
                </div>
              </PageWrapper>
            } />
          </Routes>
        </AnimatePresence>
      </main>
      
      {/* Theme Toggle for Inner Pages */}
      {!showNavAndFooter && (
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={toggleTheme}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-black/10 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/10 text-text-main hover:bg-black/20 dark:hover:bg-white/20 transition-all duration-500 relative overflow-hidden shadow-lg"
            aria-label="Toggle Theme"
          >
            <AnimatePresence mode="wait">
              {theme === 'dark' ? (
                <motion.div key="sun" initial={{ y: -30, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 30, opacity: 0, rotate: 90 }} transition={{ duration: 0.5, ease: "easeInOut" }} className="absolute">
                  <Sun size={24} className="text-amber-400" />
                </motion.div>
              ) : (
                <motion.div key="moon" initial={{ y: -30, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 30, opacity: 0, rotate: 90 }} transition={{ duration: 0.5, ease: "easeInOut" }} className="absolute">
                  <Moon size={24} className="text-indigo-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {showNavAndFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
