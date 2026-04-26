import { Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export default function Footer() {
  const { addToast } = useToast();

  return (
    <footer className="border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <Car className="text-primary w-5 h-5" />
          <span className="text-xl font-bold text-text-main">Vroom</span>
        </div>
        
        <div className="text-sm text-text-muted flex flex-wrap justify-center gap-6">
          <Link to="/#how-it-works" onClick={(e) => { if(window.location.pathname === '/') { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); } }} className="hover:text-primary transition-colors">How it Works</Link>
          <Link to="/#safety" onClick={(e) => { if(window.location.pathname === '/') { e.preventDefault(); document.getElementById('safety')?.scrollIntoView({ behavior: 'smooth' }); } }} className="hover:text-primary transition-colors">Safety</Link>
          <a href="mailto:support@vroom.com" className="hover:text-primary transition-colors">Contact Us</a>
        </div>
        
        <p className="text-sm text-text-muted">
          &copy; {new Date().getFullYear()} Vroom. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
