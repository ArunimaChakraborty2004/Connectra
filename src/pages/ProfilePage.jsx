import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import { toast } from '../lib/toast';
import { Settings, MapPin, Link as LinkIcon, Code, Briefcase } from 'lucide-react';
import Feed from '../components/Feed'; // Reuse Feed component but maybe pass userId filter

export default function ProfilePage({ session }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // Load current user profile for Sidebar
      const { data: currUser } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setCurrentUserProfile(currUser || { id: session.user.id, username: 'User' });

      // Load requested profile
      const { data: targetProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error || !targetProfile) {
        toast.error('Profile not found');
        setProfile(null);
      } else {
        setProfile(targetProfile);
      }
      setLoading(false);
    };
    loadData();
  }, [username, session.user.id]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen bg-[#000] text-[#ededed] font-sans">
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          <Sidebar profile={currentUserProfile} stats={{followers:0,following:0}} />
        </div>
        
        <div className="flex-1 w-full max-w-2xl shrink-0">
          {!profile ? (
            <EmptyState title="User not found" description="The profile you are looking for does not exist." />
          ) : (
            <>
              {/* Profile Header */}
              <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl overflow-hidden mb-6 relative">
                <div className="h-32 bg-gradient-to-r from-primary/20 to-purple-500/20"></div>
                
                <div className="px-6 pb-6 relative">
                  <div className="flex justify-between items-end -mt-12 mb-4">
                    <div className="h-24 w-24 rounded-2xl bg-[#111] border-4 border-[#0a0a0a] flex items-center justify-center text-4xl font-bold text-white overflow-hidden shadow-xl">
                      {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" /> : profile.username[0].toUpperCase()}
                    </div>
                    {session.user.id === profile.id ? (
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors border border-white/10">
                        <Settings size={16} /> Edit Profile
                      </button>
                    ) : (
                      <button className="px-5 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">
                        Connect
                      </button>
                    )}
                  </div>
                  
                  <div>
                    <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
                    <p className="text-[#888] mt-1 text-[15px]">{profile.bio || 'No bio provided.'}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-[#888]">
                    {profile.website_url && (
                      <a href={profile.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <LinkIcon size={16} /> Portfolio
                      </a>
                    )}
                    {profile.github_url && (
                      <a href={profile.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <Code2 size={16} /> GitHub
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <Briefcase size={16} /> LinkedIn
                      </a>
                    )}
                  </div>
                  
                  {profile.tech_stack && (
                    <div className="mt-6">
                      <h4 className="text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Tech Stack</h4>
                      <div className="flex gap-2 flex-wrap">
                        {profile.tech_stack.split(',').map((tech, i) => (
                          <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white">
                            {tech.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* User's Posts Feed */}
              <div className="mb-4 text-lg font-bold text-white border-b border-[#222] pb-2 mt-8">Recent Activity</div>
              <Feed session={session} userIdFilter={profile.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
