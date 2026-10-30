import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from './Sidebar';
import Feed from './Feed';
import Rightbar from './Rightbar';
import { Hexagon } from 'lucide-react';

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  const loadData = async () => {
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, username, bio, tech_stack, github_url, xp, level, avatar_url')
      .eq('id', session.user.id)
      .single();

    if (!error && profileData) {
      if (!profileData.username) {
        const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'developer';
        supabase.from('profiles').update({ username: fallbackName }).eq('id', session.user.id).then(() => {});
        profileData.username = fallbackName;
      }
      setProfile(profileData);
    } else {
      const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User';
      supabase.from('profiles').upsert({ id: session.user.id, username: fallbackName }).then(() => {});
      setProfile({ id: session.user.id, username: fallbackName, xp: 0, level: 1 });
    }

    try {
      const { count: followersCount } = await supabase
        .from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session.user.id);
      const { count: followingCount } = await supabase
        .from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session.user.id);
      const { count: acceptedConnectionsCount } = await supabase
        .from('connections').select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .eq('status', 'accepted');

      const netConns = acceptedConnectionsCount || 0;
      setStats({
        followers: (followersCount || 0) + netConns,
        following: (followingCount || 0) + netConns,
        connections: netConns,
      });
    } catch {
      setStats({ followers: 0, following: 0, connections: 0 });
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('refreshStats', handleRefresh);
    return () => window.removeEventListener('refreshStats', handleRefresh);
  }, [session]);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf6f0]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin text-orange-600"><Hexagon size={40} /></div>
          <p className="text-sm font-semibold text-[#8d7565]">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2b1f17]">
      <div className="max-w-[1380px] mx-auto px-4 py-6 flex gap-6 items-start">
        {/* Left Sidebar */}
        <div className="hidden lg:block shrink-0 w-[210px]">
          <Sidebar profile={profile} stats={stats} />
        </div>

        {/* Main Feed */}
        <div className="flex-1 min-w-0 max-w-[650px]">
          <Feed session={session} />
        </div>

        {/* Right Sidebar */}
        <div className="hidden xl:block shrink-0 w-[300px]">
          <Rightbar profile={profile} onProfileUpdate={loadData} />
        </div>
      </div>
    </div>
  );
}
