import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';
import { toast } from '../lib/toast';
import { Settings, MapPin, Link as LinkIcon, Code2, Briefcase, Grid, FileText, FolderGit2, GitBranch, ExternalLink, MessageCircle, Trophy, CheckCircle2, Clock, UserPlus, UserCheck, UserMinus, Flame } from 'lucide-react';
import Feed from '../components/Feed';
import EditProfileModal from '../components/profile/EditProfileModal';
import BadgesPanel from '../components/profile/BadgesPanel';
import AIReviewPanel from '../components/profile/AIReviewPanel';
import FollowsModal from '../components/profile/FollowsModal';
import { createNotification } from '../lib/notifications';
import { calculateUserStreak } from '../utils/streakHelper';

function ProfileRepos({ userId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (data) setProjects(data);
      setLoading(false);
    };
    fetchProjects();
  }, [userId]);

  if (loading) return <div className="text-center py-8 text-muted">Loading repositories...</div>;

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-xl bg-surface mt-4">
        <FolderGit2 size={48} className="mx-auto text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-main mb-2">No repositories yet</h3>
        <p className="text-gray-400 text-sm">This user hasn't added any repositories.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {projects.map(p => (
        <div key={p.id} className="group p-5 glass-panel rounded-xl hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <Link to={`/projects/${p.id}`} className="text-lg font-bold text-main hover:text-primary transition-colors cursor-pointer hover:underline block truncate max-w-[70%]">
              {p.title}
            </Link>
            <div className="flex gap-2">
              {p.repo_url && (
                <a href={p.repo_url} target="_blank" rel="noreferrer" className="p-2 bg-surface hover:bg-surface-hover text-gray-300 hover:text-main rounded-lg transition-colors tooltip" title="Repository">
                  <GitBranch size={16} />
                </a>
              )}
              {p.demo_url && (
                <a href={p.demo_url} target="_blank" rel="noreferrer" className="p-2 bg-surface hover:bg-surface-hover text-gray-300 hover:text-main rounded-lg transition-colors tooltip" title="Live Demo">
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2 line-clamp-2">{p.description}</p>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage({ session }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [repoCount, setRepoCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [streak, setStreak] = useState(1);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [profileStats, setProfileStats] = useState({ followers: 0, following: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [showFollowsModal, setShowFollowsModal] = useState(false);
  const [followsModalTab, setFollowsModalTab] = useState('followers');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // Load current user profile for Sidebar
      const { data: currUser } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setCurrentUserProfile(currUser || { id: session.user.id, username: 'User' });

      // Load requested profile (try username first, fallback to id if UUID)
      let targetProfile = null;
      const { data: byUsername } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      targetProfile = byUsername;

      if (!targetProfile) {
        const { data: byId } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', username)
          .maybeSingle();
        targetProfile = byId;
      }
      
      if (!targetProfile) {
        toast.error('Profile not found');
        setProfile(null);
      } else {
        setProfile(targetProfile);
        
        // Load target profile follower & following counts
        const { count: targetFollowersCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetProfile.id);

        const { count: targetFollowingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetProfile.id);

        setProfileStats({
          followers: targetFollowersCount || 0,
          following: targetFollowingCount || 0,
        });

        // Load follow relationship if not viewing self
        if (targetProfile.id !== session.user.id) {
          // Do I follow target?
          const { data: followingRecord } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', session.user.id)
            .eq('following_id', targetProfile.id)
            .maybeSingle();

          // Does target follow me?
          const { data: followerRecord } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', targetProfile.id)
            .eq('following_id', session.user.id)
            .maybeSingle();

          setIsFollowing(Boolean(followingRecord));
          setIsFollower(Boolean(followerRecord));
        }

        // Load repo count for badges
        const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', targetProfile.id);
        setRepoCount(count || 0);

        // Load posts for badges, streak, and likes
        const { data: userPosts, count: pCount } = await supabase
          .from('posts')
          .select('id, created_at', { count: 'exact' })
          .eq('user_id', targetProfile.id);
        setPostCount(pCount || 0);

        // Real likes on user's posts
        let likesSum = 0;
        if (userPosts && userPosts.length > 0) {
          const postIds = userPosts.map(p => p.id);
          const { count: lCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .in('post_id', postIds);
          likesSum = lCount || 0;
        }
        setTotalLikes(likesSum);

        // Real connections count
        const { count: cCount } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`requester_id.eq.${targetProfile.id},receiver_id.eq.${targetProfile.id}`);
        setConnectionsCount(cCount || 0);

        // Real dynamic streak
        const postDates = (userPosts || []).map(p => p.created_at);
        const computedStreak = calculateUserStreak(targetProfile.id, postDates);
        setStreak(computedStreak);
      }
      setLoading(false);
    };
    loadData();
  }, [username, session.user.id]);

  const handleFollow = async () => {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    setIsFollowing(true);
    setProfileStats(prev => ({ ...prev, followers: prev.followers + 1 }));

    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: session.user.id,
        following_id: profile.id,
      });

      if (error) {
        setIsFollowing(false);
        setProfileStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        toast.error(error.message);
      } else {
        toast.success(`Following ${profile.username}!`);
        createNotification({
          userId: profile.id,
          actorId: session.user.id,
          type: 'follow',
          entityId: profile.id,
        });
        window.dispatchEvent(new Event('refreshStats'));
      }
    } catch {
      setIsFollowing(false);
      setProfileStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      toast.error('Failed to follow');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    setIsFollowing(false);
    setProfileStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));

    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('following_id', profile.id);

      if (error) {
        setIsFollowing(true);
        setProfileStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        toast.error(error.message);
      } else {
        toast.info(`Unfollowed ${profile.username}`);
        window.dispatchEvent(new Event('refreshStats'));
      }
    } catch {
      setIsFollowing(true);
      setProfileStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      toast.error('Failed to unfollow');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="min-h-screen bg-background text-main font-sans">
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
              <div className="glass-panel rounded-2xl overflow-hidden mb-6 relative">
                <div className="h-32 bg-gradient-to-r from-primary/20 to-purple-500/20"></div>
                
                <div className="px-6 pb-6 relative">
                  <div className="flex justify-between items-end -mt-12 mb-4">
                    <div className="h-24 w-24 rounded-2xl bg-surface border-4 border-background flex items-center justify-center text-4xl font-bold text-main overflow-hidden shadow-xl">
                      {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" /> : profile.username[0].toUpperCase()}
                    </div>
                    {session.user.id === profile.id ? (
                      <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-4 py-2 bg-surface-hover hover:bg-white/20 text-main rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors border border-white/10"
                      >
                        <Settings size={16} /> Edit Profile
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        {isFollowing ? (
                          <button
                            onClick={handleUnfollow}
                            disabled={actionLoading}
                            className="group px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border bg-surface-hover border-border text-main hover:border-rose-500/30"
                            title="Click to Unfollow"
                          >
                            <span className="group-hover:hidden flex items-center gap-1.5 text-emerald-400">
                              <UserCheck size={14} /> Following
                            </span>
                            <span className="hidden group-hover:flex items-center gap-1.5 text-rose-400">
                              <UserMinus size={14} /> Unfollow
                            </span>
                          </button>
                        ) : isFollower ? (
                          <button
                            onClick={handleFollow}
                            disabled={actionLoading}
                            className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                            title="Follow back this developer"
                          >
                            <UserPlus size={14} /> Follow Back
                          </button>
                        ) : (
                          <button
                            onClick={handleFollow}
                            disabled={actionLoading}
                            className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer bg-primary hover:opacity-90 text-white shadow-sm"
                            title="Follow developer"
                          >
                            <UserPlus size={14} /> Follow
                          </button>
                        )}

                        <button
                          onClick={() => document.dispatchEvent(new CustomEvent('startChat', { detail: { userId: profile.id, username: profile.username } }))}
                          className="p-2.5 bg-surface-hover hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors border border-border cursor-pointer"
                          title="Send Message"
                        >
                          <MessageCircle size={18} className="text-primary" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-bold text-main">{profile.username}</h1>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center gap-1">
                        <Flame size={12} className="fill-orange-500 text-orange-500" />
                        {streak}d Streak
                      </span>
                    </div>
                    <p className="text-muted mt-1 text-[15px]">{profile.bio || 'No bio provided.'}</p>
                    
                    {/* Follower / Following Stats */}
                    <div className="flex flex-wrap items-center gap-5 mt-3 text-sm">
                      <button
                        onClick={() => {
                          setFollowsModalTab('followers');
                          setShowFollowsModal(true);
                        }}
                        className="text-main font-semibold hover:text-primary transition-colors cursor-pointer group flex items-center gap-1"
                      >
                        <span className="font-bold text-main group-hover:text-primary">{profileStats.followers}</span>
                        <span className="font-normal text-muted group-hover:underline">Followers</span>
                      </button>

                      <button
                        onClick={() => {
                          setFollowsModalTab('following');
                          setShowFollowsModal(true);
                        }}
                        className="text-main font-semibold hover:text-primary transition-colors cursor-pointer group flex items-center gap-1"
                      >
                        <span className="font-bold text-main group-hover:text-primary">{profileStats.following}</span>
                        <span className="font-normal text-muted group-hover:underline">Following</span>
                      </button>

                      <span className="text-main font-semibold">
                        {postCount} <span className="font-normal text-muted">Posts</span>
                      </span>

                      <span className="text-main font-semibold">
                        {connectionsCount} <span className="font-normal text-muted">Connections</span>
                      </span>

                      <span className="text-main font-semibold flex items-center gap-1">
                        <Flame size={14} className="text-orange-500 fill-orange-500" />
                        {streak} <span className="font-normal text-muted">Day Streak</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted">
                    {profile.website_url && (
                      <a href={profile.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-main transition-colors">
                        <LinkIcon size={16} /> Portfolio
                      </a>
                    )}
                    {profile.github_url && (
                      <a href={profile.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-main transition-colors">
                        <Code2 size={16} /> GitHub
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-main transition-colors">
                        <Briefcase size={16} /> LinkedIn
                      </a>
                    )}
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Link 
                      to={`/profile/${profile.username}/coding`}
                      className="flex-1 py-2 glass-panel rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors border border-white/10 text-sm font-semibold"
                    >
                      <Code2 size={16} className="text-primary" /> Coding Profile
                    </Link>
                    <Link 
                      to={`/profile/${profile.username}/portfolio`}
                      className="flex-1 py-2 glass-panel rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors border border-white/10 text-sm font-semibold"
                    >
                      <Briefcase size={16} className="text-yellow-400" /> Portfolio Showcase
                    </Link>
                  </div>
                  
                  {profile.tech_stack && (
                    <div className="mt-6">
                      <h4 className="text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Tech Stack</h4>
                      <div className="flex gap-2 flex-wrap">
                        {profile.tech_stack.split(',').map((tech, i) => (
                          <span key={i} className="px-3 py-1 glass-panel rounded-full text-xs text-main">
                            {tech.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Profile Tabs */}
              <div className="flex gap-8 border-b border-white/10 mt-8 mb-6">
                <button 
                  onClick={() => setActiveTab('posts')} 
                  className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors relative ${activeTab === 'posts' ? 'text-main' : 'text-muted hover:text-main'}`}
                >
                  <Grid size={16} />
                  Posts
                  {activeTab === 'posts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('repos')} 
                  className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors relative ${activeTab === 'repos' ? 'text-main' : 'text-muted hover:text-main'}`}
                >
                  <FolderGit2 size={16} />
                  Repositories
                  {activeTab === 'repos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('badges')} 
                  className={`flex items-center gap-2 pb-4 font-semibold text-sm transition-colors relative ${activeTab === 'badges' ? 'text-main' : 'text-muted hover:text-main'}`}
                >
                  <Trophy size={16} />
                  Badges
                  {activeTab === 'badges' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>}
                </button>
              </div>
              
              {activeTab === 'posts' ? (
                <Feed session={session} userIdFilter={profile.id} />
              ) : activeTab === 'repos' ? (
                <ProfileRepos userId={profile.id} />
              ) : (
                <div className="flex flex-col gap-4">
                  <BadgesPanel stats={{ postCount, repoCount, totalLikes, connections: connectionsCount, streak, githubUrl: profile.github_url }} />
                  {session.user.id === profile.id && (
                    <AIReviewPanel profile={profile} repoCount={repoCount} />
                  )}
                </div>
              )}
              
              <EditProfileModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                profile={profile} 
                onUpdate={(updatedProfile) => {
                  setProfile(updatedProfile);
                  if (session.user.id === updatedProfile.id) setCurrentUserProfile(updatedProfile);
                }} 
              />

              <FollowsModal
                isOpen={showFollowsModal}
                onClose={() => setShowFollowsModal(false)}
                userId={profile.id}
                username={profile.username}
                initialTab={followsModalTab}
                session={session}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
