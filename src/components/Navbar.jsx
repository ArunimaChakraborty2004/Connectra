import { LogOut, Search, Menu, Bell, Home, Compass, Users, MessageSquare, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingNotifCount, setPendingNotifCount] = useState(8);
  const [userProfile, setUserProfile] = useState(null);

  // Global Dark Mode state management
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('connectra_global_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const toggleGlobalTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('connectra_global_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      return next;
    });
  };


  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Unread in-app notifications
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .eq('is_read', false);

        // Pending connection requests
        const { count: connCount } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', session.user.id)
          .eq('status', 'pending');

        const totalUnread = (notifCount || 0) + (connCount || 0);
        setPendingNotifCount(totalUnread);

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (profile) setUserProfile(profile);
      } catch {
        setPendingNotifCount(0);
      }
    };
    fetchData();

    // Listen for refreshStats custom event or route changes
    window.addEventListener('refreshStats', fetchData);
    return () => window.removeEventListener('refreshStats', fetchData);
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

  const navLinks = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Explore', path: '/search', icon: Compass },
    { label: 'Communities', path: '/communities', icon: Users },
    {
      label: 'Notifications',
      action: () => document.dispatchEvent(new CustomEvent('toggleNotifications')),
      icon: Bell,
      badge: pendingNotifCount > 0 ? pendingNotifCount : null,
    },
    { label: 'Messages', path: '/chat', icon: MessageSquare },
  ];

  const isActive = (path) => {
    if (!path) return false;
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const authorName = userProfile?.username || 'Alex Morgan';

  return (
    <header className="sticky top-0 z-50 bg-[#fffcf7]/95 backdrop-blur-md border-b border-[#f1e4d3] shadow-xs">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 h-18 flex items-center justify-between gap-4">
        {/* LEFT: Logo & Mobile Hamburger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (onOpenSidebar) onOpenSidebar();
              else document.dispatchEvent(new CustomEvent('toggleSidebar'));
            }}
            className="p-2 rounded-xl text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff4e6] lg:hidden cursor-pointer"
          >
            <Menu size={22} />
          </button>

          <Link to="/" className="flex items-center py-1 hover:opacity-95 transition-opacity">
            {/* Prominent Large Connectra Logo */}
            <img
              src="/connectra-logo.png"
              alt="Connectra"
              className="h-11 md:h-12 w-auto object-contain drop-shadow-2xs"
            />
          </Link>
        </div>

        {/* CENTER: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-2">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = item.path ? isActive(item.path) : false;

            if (item.action) {
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff4e6] transition-all cursor-pointer relative"
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'text-[#ea580c] bg-[#ffedd5] border border-[#fed7aa] font-bold shadow-2xs'
                    : 'text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff4e6]'
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? 'text-[#ea580c]' : ''}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Search & User Profile */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="relative hidden md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89284]" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Connectra"
              className="w-48 lg:w-60 bg-[#faf6f0] border border-[#f1e4d3] rounded-full pl-9 pr-12 py-2.5 text-xs text-[#2b1f17] placeholder-[#a89284] outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#fffdfa] border border-[#f1e4d3] text-[#8d7565]">
              ⌘K
            </span>
          </form>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2">
            <Link
              to={`/profile/${userProfile?.username || 'alexmorgan'}`}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity p-1.5 rounded-full hover:bg-[#fff4e6]"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-[#ea580c] to-[#fbbf24] p-0.5 shadow-xs">
                <img
                  src={
                    userProfile?.avatar_url ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={authorName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <span className="text-xs font-bold text-[#2b1f17] hidden sm:block">
                {authorName}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8d7565" strokeWidth="2.5" className="hidden sm:block">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Link>

            {/* Global Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleGlobalTheme}
              className="p-2 rounded-xl text-[#8d7565] hover:text-[#2b1f17] hover:bg-[#fff4e6] transition-colors cursor-pointer"
              title={isDark ? 'Switch to Warm Cream Light' : 'Switch to Cyber Dark Mode'}
            >
              {isDark ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-[#ea580c]" />
              )}
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-[#8d7565] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>

    </header>
  );
}
