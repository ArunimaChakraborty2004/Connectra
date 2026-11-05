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
  UserMinus,
  Shield,
  Activity,
  Code2,
  BookOpen,
  ExternalLink,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { toast } from '../lib/toast';
import Loader from '../components/ui/Loader';
import Feed from '../components/Feed';
import { getCommunityById, CURATED_COMMUNITIES } from '../data/communitiesData';

export default function CommunityDetailsPage({ session }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'about' | 'members' | 'resources'

  useEffect(() => {
    fetchCommunityData();
  }, [id, session?.user?.id]);

  const fetchCommunityData = async () => {
    setLoading(true);
    try {
      // 1. First check if it matches a Curated Technical Guild
      const curated = getCommunityById(id);

      // Check local join cache
      const localJoined = JSON.parse(localStorage.getItem('connectra_joined_communities') || '[]');
      const isLocallyJoined = localJoined.includes(id) || (curated && localJoined.includes(curated.id));

      if (curated) {
        setCommunity(curated);
        setIsJoined(isLocallyJoined);

        // Populate curated initial member list
        setMembers([
          {
            id: 'lead-1',
            role: 'owner',
            joined_at: curated.created_at,
            profiles: {
              id: 'lead-profile',
              username: curated.creator?.username || 'guild_lead',
              avatar_url: curated.creator?.avatar_url,
              bio: curated.creator?.bio || 'Technical Guild Lead Architect',
              level: 8,
              xp: 4200
            }
          },
          {
            id: 'core-2',
            role: 'moderator',
            joined_at: '2024-02-15T12:00:00Z',
            profiles: {
              id: 'core-profile-2',
              username: 'alex_systems',
              avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
              bio: 'DevSecOps & Rust Concurrency Contributor',
              level: 6,
              xp: 2950
            }
          },
          {
            id: 'core-3',
            role: 'member',
            joined_at: '2024-03-01T09:30:00Z',
            profiles: {
              id: 'core-profile-3',
              username: 'elena_ai',
              avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
              bio: 'LLM Evaluator & Prompt Security Researcher',
              level: 5,
              xp: 2100
            }
          }
        ]);

        setLoading(false);
        return;
      }

      // 2. Otherwise fetch from Supabase communities table
      const { data: commData, error: commError } = await supabase
        .from('communities')
        .select('*, profiles:creator_id(username, avatar_url)')
        .eq('id', id)
        .maybeSingle();

      if (commError || !commData) {
        // Fallback to first curated guild if not found
        const fallback = CURATED_COMMUNITIES[0];
        setCommunity(fallback);
        setIsJoined(localJoined.includes(fallback.id));
        setLoading(false);
        return;
      }

      setCommunity(commData);

      // Check database membership
      if (session?.user?.id) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('id, role')
          .eq('community_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        setIsJoined(!!memberData || isLocallyJoined);
      } else {
        setIsJoined(isLocallyJoined);
      }

      // Fetch members from database
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
    if (!community || joining) return;
    setJoining(true);

    const newJoinedState = !isJoined;
    setIsJoined(newJoinedState);

    // Update local storage cache immediately
    const localJoined = JSON.parse(localStorage.getItem('connectra_joined_communities') || '[]');
    let updatedLocal;
    if (newJoinedState) {
      updatedLocal = Array.from(new Set([...localJoined, community.id]));
      toast.success(`Welcome to ${community.name}! 🎉`);
      setCommunity(prev => ({ ...prev, member_count: (prev.member_count || 0) + 1 }));
    } else {
      updatedLocal = localJoined.filter(cid => cid !== community.id);
      toast.success(`Left ${community.name}`);
      setCommunity(prev => ({ ...prev, member_count: Math.max(0, (prev.member_count || 1) - 1) }));
    }
    localStorage.setItem('connectra_joined_communities', JSON.stringify(updatedLocal));

    // Try Supabase sync if it's a real database UUID and user is logged in
    if (session?.user?.id && !community.id.startsWith('guild-')) {
      try {
        if (!newJoinedState) {
          await supabase
            .from('community_members')
            .delete()
            .eq('community_id', community.id)
            .eq('user_id', session.user.id);

          await supabase
            .from('communities')
            .update({ member_count: Math.max(0, (community.member_count || 1) - 1) })
            .eq('id', community.id);
        } else {
          await supabase
            .from('community_members')
            .insert({ community_id: community.id, user_id: session.user.id });

          await supabase
            .from('communities')
            .update({ member_count: (community.member_count || 0) + 1 })
            .eq('id', community.id);
        }
      } catch (err) {
        console.warn('Membership Supabase sync note:', err);
      }
    }

    setJoining(false);
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Guild link copied to clipboard!');
    }
  };

  if (loading) return <Loader />;
  if (!community) return null;

  const isCreator = community.creator_id === session?.user?.id;

  return (
    <div className="min-h-screen bg-background text-main transition-colors pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Top Navigation Back Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/communities"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to Technical Guilds</span>
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold glass-panel text-muted hover:text-primary transition-colors cursor-pointer"
          >
            <Share2 size={14} />
            <span>Share Guild</span>
          </button>
        </div>

        {/* Guild Banner & Hero Header */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-border shadow-2xl relative">
          {/* Ambient Banner Backdrop */}
          <div 
            className="h-40 sm:h-52 w-full relative bg-cover bg-center border-b border-border flex items-end p-6"
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.85)), url(${community.banner_url || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'})`
            }}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 backdrop-blur-md text-white border border-white/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{community.active_now || 28} Devs Active</span>
              </span>
            </div>
          </div>

          {/* Profile & Metadata Info */}
          <div className="px-6 pb-6 pt-0 relative bg-surface">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
              <div className="flex items-end gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-surface border-4 border-surface shadow-2xl flex items-center justify-center text-4xl sm:text-5xl shrink-0">
                  {community.icon || '🛡️'}
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-black text-main">
                      {community.name}
                    </h1>
                    {community.is_private ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                        <Lock size={11} /> Enclave (Private)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Globe size={11} /> Public Guild
                      </span>
                    )}
                    {community.is_verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Shield size={11} /> Verified Hub
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted font-mono mt-0.5">connectra.dev/c/{community.slug || community.id.slice(0, 8)}</p>
                </div>
              </div>

              {/* Join / Leave Action Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleJoin}
                  disabled={joining}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer ${
                    isJoined
                      ? 'bg-surface text-muted border border-border hover:bg-red-500/15 hover:text-red-400 hover:border-red-400/30'
                      : 'vibrant-btn'
                  }`}
                >
                  {isJoined ? (
                    <>
                      <UserMinus size={16} />
                      <span>Joined ✓</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Join Guild</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-muted text-sm sm:text-base leading-relaxed max-w-3xl mt-2">
              {community.description || 'Welcome to this technical guild. Review architecture, audit code snippets, and collaborate with peer developers.'}
            </p>

            {/* Tags Strip */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(community.tags || ['ZeroTrust', 'OpenSource', 'DevSecOps']).map(t => (
                <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-background border border-border text-muted">
                  #{t}
                </span>
              ))}
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1.5 font-medium">
                <Users size={14} className="text-primary" />
                <strong className="text-main font-bold">{(community.member_count || 1).toLocaleString()}</strong> Total Members
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Est. {new Date(community.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
              {community.creator?.username && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Lead: <Link to={`/profile/${community.creator.username}`} className="text-main hover:text-primary font-bold underline-offset-2 hover:underline">@{community.creator.username}</Link>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'glass-panel text-muted hover:text-main'
            }`}
          >
            <MessageSquare size={16} />
            <span>Discussions & Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'members'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'glass-panel text-muted hover:text-main'
            }`}
          >
            <Users size={16} />
            <span>Active Members ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'resources'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'glass-panel text-muted hover:text-main'
            }`}
          >
            <BookOpen size={16} />
            <span>Technical Resources</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'about'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'glass-panel text-muted hover:text-main'
            }`}
          >
            <Info size={16} />
            <span>Zero-Trust Rules</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content Area (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'feed' && (
              <Feed
                session={session}
                communityIdFilter={community.id}
                placeholder={`Post code, triage an issue, or discuss architecture in ${community.name}...`}
              />
            )}

            {activeTab === 'members' && (
              <div className="glass-panel p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="font-extrabold text-base text-main">
                    Guild Members
                  </h3>
                  <span className="text-xs text-muted font-mono">{members.length} verified engineers</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {members.map(m => {
                    const u = m.profiles;
                    if (!u) return null;
                    return (
                      <Link
                        key={m.id}
                        to={`/profile/${u.username}`}
                        className="p-3.5 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all flex items-center gap-3 group"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 border border-border">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username?.[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-main truncate group-hover:text-primary transition-colors">
                              @{u.username}
                            </p>
                            {m.role === 'owner' ? (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500">
                                LEAD
                              </span>
                            ) : m.role === 'moderator' ? (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400">
                                CORE
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted truncate mt-0.5">
                            {u.bio || `Level ${u.level || 1} Developer`}
                          </p>
                          <span className="text-[10px] text-muted flex items-center gap-1 mt-1">
                            <Sparkles size={10} className="text-amber-500" /> {u.xp || 1500} XP
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="glass-panel p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-black text-main mb-1">Curated Guild Resources</h3>
                  <p className="text-xs text-muted">Verified architectural specifications, security checklists, and benchmark repositories.</p>
                </div>

                <div className="space-y-3">
                  {(community.resources || [
                    { title: 'OWASP Top 10 Guidelines', type: 'Doc', url: 'https://owasp.org' },
                    { title: 'Rust Concurrency & Memory Safety Specifications', type: 'Guide', url: 'https://rust-lang.org' },
                    { title: 'Cilium eBPF Security Observability Playground', type: 'Sandbox', url: 'https://ebpf.io' }
                  ]).map((res, i) => (
                    <a
                      key={i}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {res.type || 'Doc'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-main group-hover:text-primary transition-colors">
                            {res.title}
                          </h4>
                          <span className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <span>Verified Reference</span>
                          </span>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-muted group-hover:text-primary transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="glass-panel p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-black text-main mb-2">Guild Mission & Scope</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {community.description || 'A dedicated developer space for high-caliber technical discussions and code verification.'}
                  </p>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-bold text-main mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-emerald-400" />
                    <span>Zero-Trust Guild Protocols</span>
                  </h4>
                  <ul className="space-y-2.5 text-xs text-muted">
                    {(community.rules || [
                      'All pasted code snippets are scanned against Common Weakness Enumerations (CWEs).',
                      'No hardcoded tokens, API keys, or plaintext secrets in discussions.',
                      'Provide reproducible proofs and benchmarks for architecture claims.',
                      'Maintain constructive, high-signal developer etiquette.'
                    ]).map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Info Widgets (1 Col) */}
          <div className="space-y-6">
            
            {/* Guild Snapshot */}
            <div className="glass-panel p-5 rounded-3xl space-y-4">
              <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Guild Snapshot</h4>
              <p className="text-xs text-muted leading-relaxed">
                {community.description}
              </p>

              <div className="space-y-2.5 pt-2 border-t border-border text-xs">
                <div className="flex justify-between items-center text-muted">
                  <span>Guild Type</span>
                  <span className="text-main font-bold capitalize">
                    {community.is_private ? 'Zero-Trust Enclave' : 'Open Technical Forum'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>Category</span>
                  <span className="text-main font-bold">{community.category || 'Engineering'}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>Total Members</span>
                  <span className="text-main font-bold">{(community.member_count || 1).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>Security Audit</span>
                  <span className="text-emerald-400 font-bold">Active AST Scanner</span>
                </div>
              </div>
            </div>

            {/* AI Architecture Tip Card */}
            <div className="glass-panel p-5 rounded-3xl space-y-3 bg-gradient-to-br from-primary/10 via-surface to-purple-500/10 border border-primary/20">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Sparkles size={16} />
                <span>Zero-Trust Code Screen</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Posts and code snippets published in this guild are screened in real time to prevent credentials leaks and CWE vulnerabilities.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
