import { LogOut, Search, Menu, Bell, Home, Compass, Users, MessageSquare, Sun, Moon, Shield, X, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SecurityHubModal from './security/SecurityHubModal';

export default function Navbar({ onOpenSidebar, session: propSession, profile: propProfile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNavSuggestions, setShowNavSuggestions] = useState(false);
  const [navProfilesCache, setNavProfilesCache] = useState([]);
  const navSearchRef = useRef(null);
  const navInputRef = useRef(null);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);
  const [userProfile, setUserProfile] = useState(propProfile || null);
  const [showSecurityHub, setShowSecurityHub] = useState(false);
  const [session, setSession] = useState(propSession || null);

  useEffect(() => {
    if (propProfile) setUserProfile(propProfile);
  }, [propProfile]);

  useEffect(() => {
    if (propSession) setSession(propSession);
  }, [propSession]);

  // Pre-load profiles for zero-latency typeahead search in Navbar
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, tech_stack, role, bio')
      .limit(60)
      .then(({ data }) => {
        if (data) setNavProfilesCache(data);
      });
  }, []);

  // Click outside and Cmd+K / Ctrl+K keyboard shortcut handler
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navSearchRef.current && !navSearchRef.current.contains(e.target)) {
        setShowNavSuggestions(false);
      }
    };
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navInputRef.current?.focus();
        setShowNavSuggestions(true);
      }
      if (e.key === 'Escape') {
        setShowNavSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    let activeChannel = null;

    const fetchData = async () => {
      try {
        let currentSession = propSession || session;
        if (!currentSession) {
          const { data } = await supabase.auth.getSession();
          currentSession = data?.session;
          if (currentSession) setSession(currentSession);
        }

        const activeUserId = currentSession?.user?.id;
        if (!activeUserId) return;

        // Unread in-app notifications
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', activeUserId)
          .eq('is_read', false);

        // Pending connection requests
        const { count: connCount } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', activeUserId)
          .eq('status', 'pending');

        const totalUnread = (notifCount || 0) + (connCount || 0);
        setPendingNotifCount(totalUnread);

        if (!propProfile) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url, full_name')
            .eq('id', activeUserId)
            .single();
          if (profile) setUserProfile(profile);
        }
      } catch (err) {
        console.warn('Navbar stats error:', err);
      }
    };

    fetchData();

    // Listen for refreshStats custom event or route changes
    window.addEventListener('refreshStats', fetchData);

    // Setup realtime subscription for instant notifications when someone likes or comments
    const activeUserId = propSession?.user?.id || session?.user?.id;
    if (activeUserId) {
      activeChannel = supabase
        .channel(`navbar-notifs-${activeUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${activeUserId}` },
          () => fetchData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'connections', filter: `receiver_id=eq.${activeUserId}` },
          () => fetchData()
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('refreshStats', fetchData);
      if (activeChannel) activeChannel.unsubscribe();
    };
  }, [location.pathname, propSession?.user?.id]);

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

  const currentProfile = propProfile || userProfile;
  const currentSessionUser = propSession?.user || session?.user;
  const authorName =
    currentProfile?.username ||
    currentProfile?.full_name ||
    currentSessionUser?.user_metadata?.username ||
    currentSessionUser?.email?.split('@')[0] ||
    'User';
  const authorInitial = authorName[0]?.toUpperCase() || 'U';
  const avatarUrl = currentProfile?.avatar_url || currentSessionUser?.user_metadata?.avatar_url || null;
  const cleanNavQ = searchQuery.trim().replace(/^#/, '');
  const activeUserId = propSession?.user?.id || session?.user?.id;
  const navSuggestions = cleanNavQ
    ? navProfilesCache
        .filter((u) => u && u.id !== activeUserId)
        .map((u) => {
          const lq = cleanNavQ.toLowerCase();
          const uname = (u.username || '').toLowerCase();
          const fname = (u.full_name || '').toLowerCase();
          let score = 0;
          if (uname === lq) score = 100;
          else if (uname.startsWith(lq)) score = 85;
          else if (fname.startsWith(lq)) score = 75;
          else if (uname.includes(lq)) score = 50;
          else if (fname.includes(lq)) score = 40;
          else if ((u.bio || '').toLowerCase().includes(lq)) score = 15;
          return { ...u, score };
        })
        .filter((u) => u.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
    : [];

  const highlightNavMatch = (text, q) => {
    if (!q || !text) return text;
    const str = String(text);
    const idx = str.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return str;
    return (
      <>
        {str.slice(0, idx)}
        <span className="text-orange-500 font-extrabold underline decoration-orange-500/40">
          {str.slice(idx, idx + q.length)}
        </span>
        {str.slice(idx + q.length)}
      </>
    );
  };

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
          {/* Instant Search Bar with Typeahead Suggestions */}
          <div ref={navSearchRef} className="relative hidden md:block">
            <form onSubmit={handleSearch} className="relative">
              <button
                type="submit"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[#a89284] hover:text-[#ea580c] p-1.5 rounded-full transition-colors cursor-pointer"
                title="Search Connectra"
              >
                <Search size={15} />
              </button>
              <input
                ref={navInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowNavSuggestions(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setShowNavSuggestions(true);
                }}
                placeholder="Search Connectra..."
                className="w-48 lg:w-60 bg-[#faf6f0] dark:bg-stone-900 border border-[#f1e4d3] dark:border-stone-800 rounded-full pl-9 pr-12 py-2.5 text-xs text-[#2b1f17] dark:text-stone-100 placeholder-[#a89284] outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-stone-800 focus:ring-2 focus:ring-orange-200 transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowNavSuggestions(false);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8d7565] hover:text-[#ea580c] cursor-pointer p-0.5 rounded-full"
                  title="Clear"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#fffdfa] dark:bg-stone-800 border border-[#f1e4d3] dark:border-stone-700 text-[#8d7565]">
                  ⌘K
                </span>
              )}
            </form>

            {/* Instant Floating Typeahead Suggestions Popup */}
            <AnimatePresence>
              {showNavSuggestions && cleanNavQ && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-stone-900 border border-[#f1e4d3] dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
                >
                  <div className="p-2.5 px-3.5 border-b border-[#f1e4d3] dark:border-stone-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-orange-500 flex items-center gap-1.5">
                      <Users size={13} />
                      Matching Developers ({navSuggestions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNavSuggestions(false)}
                      className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {navSuggestions.length > 0 ? (
                    <div className="py-1 divide-y divide-[#f5eee6] dark:divide-stone-800 max-h-64 overflow-y-auto">
                      {navSuggestions.map((u) => {
                        const displayName = u.username || u.full_name || 'Developer';
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setShowNavSuggestions(false);
                              navigate(`/${u.username || u.id}`);
                            }}
                            className="p-2.5 px-3.5 flex items-center justify-between gap-2.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-orange-500 to-amber-500 p-0.5 shrink-0 flex items-center justify-center">
                                {u.avatar_url ? (
                                  <img
                                    src={u.avatar_url}
                                    alt={displayName}
                                    className="w-full h-full object-cover rounded-full"
                                  />
                                ) : (
                                  <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white text-[11px] font-bold">
                                    {(displayName || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="text-xs font-bold text-[#2b1f17] dark:text-stone-100 truncate">
                                  {highlightNavMatch(u.full_name || displayName, cleanNavQ)}
                                </p>
                                <p className="text-[11px] font-mono text-orange-600 dark:text-orange-400 truncate">
                                  @{highlightNavMatch(u.username || 'developer', cleanNavQ)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNavSuggestions(false);
                                  navigate(`/chat?user=${u.id}`);
                                }}
                                className="p-1.5 rounded-lg border border-[#f1e4d3] dark:border-stone-700 text-[#8d7565] hover:text-orange-500 hover:border-orange-500 transition-colors cursor-pointer"
                                title={`Message @${u.username}`}
                              >
                                <MessageSquare size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-stone-500 dark:text-stone-400">
                      No developers found for &ldquo;<span className="text-orange-500 font-bold">{cleanNavQ}</span>&rdquo;
                    </div>
                  )}

                  <div
                    onClick={handleSearch}
                    className="p-2.5 px-3.5 border-t border-[#f1e4d3] dark:border-stone-800 flex items-center justify-between text-[11px] text-[#8d7565] dark:text-stone-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer font-medium"
                  >
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} className="text-orange-500" />
                      Press <kbd className="px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-[10px] font-mono border border-stone-200 dark:border-stone-700">Enter</kbd> to search all
                    </span>
                    <span className="text-orange-600 dark:text-orange-400 font-bold hover:underline">Explore &rarr;</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2">
            <Link
              to={`/profile/${currentProfile?.username || authorName}`}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity p-1.5 rounded-full hover:bg-[#fff4e6] dark:hover:bg-white/5"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-[#ea580c] to-[#fbbf24] p-0.5 shadow-xs flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={authorName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center text-white text-xs font-bold">
                    {authorInitial}
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-[#2b1f17] dark:text-stone-100 hidden sm:block">
                {authorName}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8d7565" strokeWidth="2.5" className="hidden sm:block">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Link>

            {/* Zero-Trust Security & Research Hub Button */}
            <button
              onClick={() => setShowSecurityHub(true)}
              className="p-2 rounded-xl text-[#8d7565] hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer relative"
              title="Zero-Trust Security & Research Benchmark Hub"
            >
              <Shield size={18} className="text-emerald-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

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

      {/* Security Hub Modal */}
      <SecurityHubModal
        isOpen={showSecurityHub}
        onClose={() => setShowSecurityHub(false)}
        session={session}
      />
    </header>
  );
}
