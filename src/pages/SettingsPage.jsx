import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Loader from '../components/ui/Loader';
import { Moon, Sun, Settings as SettingsIcon, User, Bell } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { toast } from '../lib/toast';

export default function SettingsPage({ session }) {
  const [profile, setProfile] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data || { id: session.user.id, username: 'User' });
    };
    loadProfile();
  }, [session]);

  const handleSave = () => {
    toast.success('Settings saved successfully!');
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

              {/* Account Settings Stub Section */}
              <section>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <User size={20} />
                  Account Settings
                </h3>
                <div className="glass-panel p-4 rounded-xl space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-muted">Email Address</label>
                    <input 
                      type="email" 
                      disabled 
                      value={session?.user?.email || ''} 
                      className="w-full bg-surface/50 border border-white/5 rounded-lg px-4 py-2 text-muted cursor-not-allowed" 
                    />
                    <p className="text-xs text-muted mt-1">To change your email, contact support.</p>
                  </div>
                </div>
              </section>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
