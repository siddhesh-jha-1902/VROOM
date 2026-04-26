import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md min-w-[300px] max-w-md
                ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
                  toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 
                  'bg-black/80 dark:bg-white/10 border-black/10 dark:border-white/10 text-white'}`}
            >
              <div className="flex items-center gap-3">
                {toast.type === 'error' ? <AlertCircle size={20} /> : toast.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                <p className="text-sm font-medium">{toast.message}</p>
              </div>
              <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-current">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
