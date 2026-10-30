import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Globe, 
  Lock, 
  ArrowLeft, 
  Calendar, 
  ShieldCheck, 
  MessageSquare, 
  Share2, 
  Sparkles,
  Info,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { toast } from '../lib/toast';
import Loader from '../components/ui/Loader';
import Feed from '../components/Feed';

export default function CommunityDetailsPage({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'about' | 'members'

  useEffect(() => {
    fetchCommunityData();
  }, [id]);

  const fetchCommunityData = async () => {
    setLoading(true);
    try {
      // 1. Fetch community details + creator profile
      const { data: commData, error: commError } = await supabase
        .from('communities')
        .select('*, profiles:creator_id(username, avatar_url)')
        .eq('id', id)
        .single();

      if (commError || !commData) {
        toast.error('Community not found');
        navigate('/communities');
        return;
      }

      setCommunity(commData);

      // 2. Check if current user is a member
      if (session?.user?.id) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('id, role')
          .eq('community_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        setIsJoined(!!memberData);
      }

      // 3. Fetch members list
      const { data: membersList } = await supabase
        .from('community_members')
        .select('id, role, joined_at, profiles:user_id(id, username, avatar_url, bio, xp, level)')
        .eq('community_id', id)
        .order('joined_at', { ascending: false })
        .limit(30);

      setMembers(membersList || []);
    } catch (err) {
      console.error('Failed to load community details', err);
      toast.error('Error loading community');
    } finally {
      setLoading(false);
    }
  };

  const toggleJoin = async () => {
    if (!session?.user?.id || !community || joining) return;
    setJoining(true);

    try {
      if (isJoined) {
        // Leave
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', community.id)
          .eq('user_id', session.user.id);

        const newCount = Math.max(0, (community.member_count || 1) - 1);
        await supabase
          .from('communities')
          .update({ member_count: newCount })
          .eq('id', community.id);

        setIsJoined(false);
        setCommunity(prev => ({ ...prev, member_count: newCount }));
        setMembers(prev => prev.filter(m => m.profiles?.id !== session.user.id));
        toast.success(`Left ${community.name}`);
      } else {
        // Join
        await supabase
          .from('community_members')
          .insert({ community_id: community.id, user_id: session.user.id });

        const newCount = (community.member_count || 0) + 1;
        await supabase
          .from('communities')
          .update({ member_count: newCount })
          .eq('id', community.id);

        setIsJoined(true);
        setCommunity(prev => ({ ...prev, member_count: newCount }));
        toast.success(`Welcome to ${community.name}! 🎉`);
        // Refresh members list
        const { data: updatedMembers } = await supabase
          .from('community_members')
          .select('id, role, joined_at, profiles:user_id(id, username, avatar_url, bio, xp, level)')
          .eq('community_id', id)
          .order('joined_at', { ascending: false })
          .limit(30);
        if (updatedMembers) setMembers(updatedMembers);
      }
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setJoining(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Community link copied to clipboard!');
    }
  };

  if (loading) return <Loader />;
  if (!community) return null;

  const isCreator = community.creator_id === session?.user?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Navigation Back Link */}
      <div className="flex items-center justify-between">
        <Link
          to="/communities"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Communities</span>
        </Link>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-panel text-muted hover:text-primary transition-colors cursor-pointer"
        >
          <Share2 size={14} />
          <span>Share</span>
        </button>
      </div>

      {/* Community Banner & Hero Header */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
        <div 
          className="h-36 sm:h-44 w-full relative bg-gradient-to-r from-blue-600/30 via-purple-600/30 to-pink-600/30 backdrop-blur-xl border-b border-white/10 flex items-end p-6"
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-surface border-4 border-[var(--bg-color)] shadow-xl flex items-center justify-center text-4xl sm:text-5xl shrink-0">
                {community.icon || '💡'}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-main">
                    {community.name}
                  </h1>
                  {community.is_private ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      <Lock size={11} /> Private
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Globe size={11} /> Public
                    </span>
                  )}
                  {isCreator && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Creator
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mt-0.5">r/{community.slug || community.id.slice(0, 8)}</p>
              </div>
            </div>

            {/* Join / Leave Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleJoin}
                disabled={joining}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer ${
                  isJoined
                    ? 'bg-surface text-muted border border-border hover:bg-red-500/15 hover:text-red-400 hover:border-red-400/30'
                    : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'
                }`}
              >
                {isJoined ? (
                  <>
                    <UserMinus size={16} />
                    <span>Leave</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Join Community</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-muted text-sm sm:text-base leading-relaxed max-w-3xl mt-2">
            {community.description || 'Welcome to this developer community. Share code, launch discussions, and team up.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5 text-xs text-muted flex-wrap">
            <span className="flex items-center gap-1.5 font-medium">
              <Users size={14} className="text-primary" />
              <strong className="text-main font-bold">{community.member_count || 0}</strong> Members
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              Created {new Date(community.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
            {community.profiles?.username && (
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Led by <Link to={`/profile/${community.profiles.username}`} className="text-main hover:text-primary font-medium underline-offset-2 hover:underline">@{community.profiles.username}</Link>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'feed'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'text-muted hover:text-main hover:bg-surface'
          }`}
        >
          <MessageSquare size={16} />
          <span>Discussions & Feed</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'text-muted hover:text-main hover:bg-surface'
          }`}
        >
          <Users size={16} />
          <span>Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'about'
              ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
              : 'text-muted hover:text-main hover:bg-surface'
          }`}
        >
          <Info size={16} />
          <span>About & Guidelines</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed or Tab Content */}
        <div className="lg:col-span-2">
          {activeTab === 'feed' && (
            <Feed
              session={session}
              communityIdFilter={community.id}
              placeholder={`Share an update or question in ${community.name}...`}
            />
          )}

          {activeTab === 'members' && (
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-lg text-main flex items-center justify-between">
                <span>Community Members</span>
                <span className="text-xs text-muted font-normal">{members.length} active</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {members.map(m => {
                  const u = m.profiles;
                  if (!u) return null;
                  return (
                    <Link
                      key={m.id}
                      to={`/profile/${u.username}`}
                      className="p-3 rounded-xl bg-surface/50 border border-white/5 hover:border-primary/30 transition-all flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 border border-white/10">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                        ) : (
                          u.username?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-main truncate group-hover:text-primary transition-colors">
                            @{u.username}
                          </p>
                          {m.role === 'owner' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                              LEAD
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted truncate">
                          {u.bio || `Level ${u.level || 1} Developer`}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-main mb-2">Community Mission</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {community.description || 'No detailed mission specified yet.'}
                </p>
              </div>

              <div className="border-t border-white/5 pt-4">
                <h4 className="text-sm font-bold text-main mb-2">Community Rules</h4>
                <ul className="text-xs text-muted space-y-2 list-disc list-inside">
                  <li>Be respectful, collaborative, and constructive when reviewing code.</li>
                  <li>No spam, self-promotion of unrelated affiliate links, or unsolicited advertising.</li>
                  <li>Format code snippets cleanly with language tags for easy readability.</li>
                  <li>Share learnings and contribute back to open-source discussions.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info & Community Rules */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">About Community</h4>
            <p className="text-xs text-muted leading-relaxed">
              {community.description || 'A hub for developers to discuss tech, share open source projects, and grow together.'}
            </p>

            <div className="space-y-2.5 pt-2 border-t border-white/5 text-xs">
              <div className="flex justify-between items-center text-muted">
                <span>Created</span>
                <span className="text-main font-medium">
                  {new Date(community.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span>Community Type</span>
                <span className="text-main font-medium capitalize">
                  {community.is_private ? 'Private Invite' : 'Public Forum'}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span>Total Members</span>
                <span className="text-main font-bold">{community.member_count || 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl space-y-3 bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Sparkles size={16} />
              <span>Developer Spotlight</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Posts made inside this community are featured on member dashboards and can be tagged with code snippets for live peer review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
