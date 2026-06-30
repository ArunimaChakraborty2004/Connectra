import { LogOut, Hexagon, Moon, Sun, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border shadow-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          {!isHome && (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-surface-hover text-muted hover:text-main transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 glass-panel rounded-lg flex items-center justify-center text-main">
              <Hexagon size={20} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-main hidden sm:block">
              DevConnect
            </h1>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-colors text-muted hover:text-main"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 border border-border transition-all text-sm font-medium text-muted"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
