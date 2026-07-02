import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import Feed from './Feed';
import Rightbar from './Rightbar';
import { LogOut, Hexagon } from 'lucide-react';

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  const loadData = async () => {
    // 1. Fetch Profile
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, username, bio, tech_stack, github_url, xp, level')
      .eq('id', session.user.id)
      .single();
    
    if (!error && profileData) {
      setProfile(profileData);
    } else {
      setProfile({ id: session.user.id, username: session.user.email?.split('@')[0] || 'User', xp: 0, level: 1 });
    }

    // 2. Fetch Follower Counts
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', session.user.id);

    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', session.user.id);

    setStats({ followers: followersCount || 0, following: followingCount || 0 });
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-main">
          <Hexagon size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main selection:bg-white/20 font-sans selection:text-main">
      {/* Refined Ambient Glow */}
      <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-white/[0.02] blur-[120px] pointer-events-none z-0"></div>



      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          <Sidebar profile={profile} stats={stats} />
        </div>
        
        <div className="flex-1 w-full max-w-2xl shrink-0">
          <Feed session={session} />
        </div>
        
        <div className="hidden xl:block w-full max-w-[320px] shrink-0">
          <Rightbar profile={profile} onProfileUpdate={loadData} />
        </div>
      </div>
    </div>
  );
}
