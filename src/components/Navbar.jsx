import { LogOut, Hexagon, Moon, Sun, ArrowLeft, Search, Menu, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Navbar({ onOpenSidebar }) {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingNotifCount, setPendingNotifCount] = useState(0);

  useEffect(() => {
    const fetchPendingNotifs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { count } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', session.user.id)
          .eq('status', 'pending');
        setPendingNotifCount(count || 0);
      } catch (err) {
        setPendingNotifCount(0);
      }
    };
    fetchPendingNotifs();
  }, [location.pathname]);

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
    <header
      className="sticky top-0 z-50 navbar-glass"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--surface-color) 88%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            onClick={() => {
              if (onOpenSidebar) onOpenSidebar();
              else document.dispatchEvent(new CustomEvent('toggleSidebar'));
            }}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded-xl transition-colors cursor-pointer lg:hidden"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Menu size={19} />
          </button>

          {!isHome && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-1 rounded-full transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--text-color)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="h-8 w-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/25 border border-white/10">
              <Hexagon size={18} fill="currentColor" strokeWidth={1.5} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight hidden sm:block" style={{ color: 'var(--text-color)' }}>
                Connectra
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md hidden md:inline-block"
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}>
                AI &amp; SEC
              </span>
            </div>
          </Link>
        </div>

        {/* Global Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <form onSubmit={handleSearch} className="w-full relative group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors"
              size={15}
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search developers, skills, #cybersecurity..."
              className="w-full rounded-full pl-10 pr-10 py-1.5 text-xs transition-all outline-none"
              style={{
                backgroundColor: 'var(--surface-hover)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'rgba(139,92,246,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <span
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border pointer-events-none"
              style={{
                color: 'var(--text-muted)',
                backgroundColor: 'var(--surface-color)',
                borderColor: 'var(--border-color)',
                opacity: 0.6,
              }}
            >
              /
            </span>
          </form>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Notifications Bell */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('toggleNotifications'))}
            className="p-2 rounded-xl transition-colors cursor-pointer relative"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Notifications & Invitations"
          >
            <Bell size={17} />
            {pendingNotifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600"></span>
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-colors cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-color)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border-color)' }}></div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = '#f87171';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
