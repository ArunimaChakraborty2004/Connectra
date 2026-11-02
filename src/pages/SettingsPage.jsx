import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Loader from '../components/ui/Loader';
import { Moon, Sun, Settings as SettingsIcon, User, Bell, Lock, ShieldCheck, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { toast } from '../lib/toast';

export default function SettingsPage({ session }) {
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: '',
    isCurrent: true,
  });
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadProfile = async () => {
      const localPrivate = localStorage.getItem(`connectra_private_${session.user.id}`) === 'true';
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setUsername(data.username || '');
        setIsPrivate(data.is_private !== undefined ? Boolean(data.is_private) : localPrivate);
        setUsernameStatus({
          checking: false,
          available: true,
          message: 'This is your current handle.',
          isCurrent: true,
        });
      } else {
        setProfile({ id: session.user.id, username: 'User' });
        setUsername('User');
        setIsPrivate(localPrivate);
        setUsernameStatus({
          checking: false,
          available: true,
          message: 'This is your current handle.',
          isCurrent: true,
        });
      }
    };
    loadProfile();
  }, [session.user.id]);

  // Debounced real-time username uniqueness check
  useEffect(() => {
    if (!profile) return;
    const raw = username;
    if (!raw || !raw.trim()) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username cannot be empty.',
        isCurrent: false,
      });
      return;
    }

    const clean = raw.trim().toLowerCase().replace(/\s+/g, '_');

    if (profile?.username && clean === profile.username.toLowerCase()) {
      setUsernameStatus({
        checking: false,
        available: true,
        message: 'This is your current handle.',
        isCurrent: true,
      });
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username must be at least 3 characters.',
        isCurrent: false,
      });
      return;
    }

    if (clean.length > 30) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username cannot exceed 30 characters.',
        isCurrent: false,
      });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Only letters, numbers, and underscores are allowed.',
        isCurrent: false,
      });
      return;
    }

    let isMounted = true;
    setUsernameStatus(prev => ({ ...prev, checking: true, message: 'Checking availability...' }));

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', clean)
          .neq('id', session.user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.warn('Username query error:', error);
          setUsernameStatus({
            checking: false,
            available: true,
            message: '',
            isCurrent: false,
          });
          return;
        }

        if (data) {
          setUsernameStatus({
            checking: false,
            available: false,
            message: `@${clean} is already taken by another user.`,
            isCurrent: false,
          });
        } else {
          setUsernameStatus({
            checking: false,
            available: true,
            message: `@${clean} is available!`,
            isCurrent: false,
          });
        }
      } catch (err) {
        if (isMounted) {
          setUsernameStatus({
            checking: false,
            available: true,
            message: '',
            isCurrent: false,
          });
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [username, profile?.username, session.user.id]);

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem(`connectra_private_${session.user.id}`, String(isPrivate));
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
      if (!cleanUsername) {
        toast.error('Username cannot be empty.');
        setSaving(false);
        return;
      }

      if (usernameStatus.checking) {
        toast.error('Checking username availability, please wait...');
        setSaving(false);
        return;
      }
      if (usernameStatus.available === false) {
        toast.error(usernameStatus.message || `@${cleanUsername} is already taken.`);
        setSaving(false);
        return;
      }

      if (cleanUsername !== profile?.username?.toLowerCase()) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleanUsername)
          .neq('id', session.user.id)
          .maybeSingle();

        if (existingUser) {
          toast.error(`@${cleanUsername} is already taken by another user.`);
          setUsernameStatus({
            checking: false,
            available: false,
            message: `@${cleanUsername} is already taken by another user.`,
            isCurrent: false,
          });
          setSaving(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_private: isPrivate,
          full_name: fullName.trim() || null,
          username: cleanUsername,
        })
        .eq('id', session.user.id)
        .select()
        .single();

      if (error) {
        toast.error(error.message);
      } else {
        setProfile(data);
        window.dispatchEvent(new Event('refreshStats'));
        toast.success('Settings and profile updated successfully!');
      }
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-main font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          {profile ? <Sidebar profile={profile} stats={{followers:0,following:0}} /> : <Loader />}
        </div>
        
        <div className="flex-1 w-full max-w-2xl shrink-0">
          <div className="glass-panel rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-main mb-6">
              <SettingsIcon size={24} className="text-primary" />
              Settings & Preferences
            </h2>

            <div className="space-y-8">
              {/* Appearance Section */}
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
                  Appearance
                </h3>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted">Toggle between Light and Dark mode.</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className="px-4 py-2 bg-surface hover:bg-surface-hover rounded-lg font-medium transition-colors border border-white/5"
                  >
                    {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
                  </button>
                </div>
              </section>

              {/* Notifications Stub Section */}
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Bell size={20} />
                  Notifications
                </h3>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted">Receive updates and alerts via email.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-surface-hover rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </section>

              {/* Privacy & Discovery Section */}
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Lock size={20} className="text-amber-500" />
                  Privacy & Profile Visibility
                </h3>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Private Profile</p>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
                        {isPrivate ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1 max-w-md">
                      {isPrivate
                        ? 'Your profile is searchable, but details (bio, repos, tech stack) are locked until you accept a connection request.'
                        : 'Your full developer profile, skills, and projects are visible to all developers on Connectra.'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={e => setIsPrivate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-hover rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </section>

              {/* Account Settings Section */}
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <User size={20} />
                  Account & Profile Name
                </h3>
                <div className="glass-panel p-4 rounded-xl space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-main">Display / Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-surface border border-white/10 rounded-lg px-4 py-2.5 text-main placeholder:text-muted focus:outline-none focus:border-primary transition-all text-sm"
                    />
                    <p className="text-xs text-muted mt-1">Your display name shown on your profile.</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-semibold text-main">Username</label>
                      {usernameStatus.checking && (
                        <span className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-bold">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                        className={`w-full pl-8 pr-10 py-2.5 bg-surface border rounded-lg text-main placeholder:text-muted focus:outline-none transition-all text-sm font-mono ${
                          usernameStatus.checking
                            ? 'border-amber-500/50 focus:border-amber-500'
                            : usernameStatus.available === false
                            ? 'border-rose-500 focus:border-rose-500 bg-rose-500/5'
                            : usernameStatus.available === true && !usernameStatus.isCurrent
                            ? 'border-emerald-500 focus:border-emerald-500 bg-emerald-500/5'
                            : 'border-white/10 focus:border-primary'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        {usernameStatus.checking ? (
                          <Loader2 size={16} className="text-amber-500 animate-spin" />
                        ) : usernameStatus.available === false ? (
                          <XCircle size={16} className="text-rose-500" />
                        ) : usernameStatus.available === true && !usernameStatus.isCurrent ? (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : null}
                      </div>
                    </div>
                    {usernameStatus.message ? (
                      <p className={`text-xs font-medium mt-1.5 flex items-center gap-1.5 ${
                        usernameStatus.checking
                          ? 'text-amber-500'
                          : usernameStatus.available === false
                          ? 'text-rose-500'
                          : usernameStatus.available === true && !usernameStatus.isCurrent
                          ? 'text-emerald-500'
                          : 'text-muted'
                      }`}>
                        {usernameStatus.available === false && <AlertCircle size={12} className="shrink-0" />}
                        {usernameStatus.available === true && !usernameStatus.isCurrent && <CheckCircle2 size={12} className="shrink-0" />}
                        <span>{usernameStatus.message}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted mt-1">Your unique handle on Connectra.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted">Email Address</label>
                    <input 
                      type="email" 
                      disabled 
                      value={session?.user?.email || ''} 
                      className="w-full bg-surface/50 border border-white/5 rounded-lg px-4 py-2 text-muted cursor-not-allowed text-sm" 
                    />
                    <p className="text-xs text-muted mt-1">To change your email, contact support.</p>
                  </div>
                </div>
              </section>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSave}
                  disabled={saving || usernameStatus.checking || usernameStatus.available === false}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
