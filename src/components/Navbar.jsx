import { LogOut, Hexagon, Moon, Sun, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-white/5 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          {!isHome && (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface-hover text-muted hover:text-main transition-colors">
              <ArrowLeft size={18} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary-hover rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Hexagon size={18} fill="currentColor" strokeWidth={1.5} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-main hidden sm:block">
              Connectra
            </h1>
          </Link>
        </div>

        {/* Global Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <form onSubmit={handleSearch} className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Connectra..."
              className="w-full bg-surface-hover/50 border border-white/5 rounded-full pl-10 pr-4 py-1.5 text-sm text-main focus:outline-none focus:border-primary/50 focus:bg-surface-hover transition-colors"
            />
          </form>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-hover transition-colors text-muted hover:text-main"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <div className="w-px h-5 bg-border mx-2 hidden sm:block"></div>

          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors text-sm font-medium text-muted"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
