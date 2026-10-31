import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, TrendingUp, UserPlus, CheckCircle2, Zap } from 'lucide-react';
import { toast } from '../lib/toast';

export default function Rightbar({ profile }) {
  const [trendingTags, setTrendingTags] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState(new Set());
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [connectingId, setConnectingId] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set());
  const navigate = useNavigate();

  // Sparkline generator path based on post count or index
  const getSparkPath = (idx) => {
    const paths = [
      'M0,14 Q8,2 16,10 T32,6 T48,12 T60,4',
      'M0,16 Q10,18 20,8 T40,12 T50,4 T60,6',
      'M0,8 Q12,16 24,6 T40,14 T52,8 T60,4',
      'M0,14 Q10,4 20,12 T38,8 T50,14 T60,8',
      'M0,16 Q10,12 22,14 T38,6 T50,10 T60,4',
    ];
    return paths[idx % paths.length];
  };

  const getSparkColor = (idx) => {
    const colors = ['#ea580c', '#f97316', '#f59e0b', '#c2410c', '#fb923c'];
    return colors[idx % colors.length];
  };

  useEffect(() => {
    const loadDatabaseData = async () => {
      try {
        // 1. Fetch Trending Topics calculated directly from real database posts & profiles
        const { data: postsData } = await supabase
          .from('posts')
          .select('content, code_language')
          .order('created_at', { ascending: false })
          .limit(100);

        const { data: profilesTech } = await supabase
          .from('profiles')
          .select('tech_stack')
          .limit(50);

        const tagCounts = {};
        const tagCategories = {};

        // Extract #hashtags from real post content
        (postsData || []).forEach((p) => {
          if (p.content) {
            const matches = p.content.match(/#\w+/g);
            if (matches) {
              matches.forEach((rawTag) => {
                const cleaned = rawTag.replace('#', '').trim();
                if (cleaned.length > 1) {
                  const key = cleaned.toLowerCase();
                  tagCounts[key] = (tagCounts[key] || 0) + 1;
                  tagCategories[key] = tagCategories[key] || cleaned;
                }
              });
            }
          }

          // Count programming languages shared in code snippets
          if (p.code_language && p.code_language.trim()) {
            const lang = p.code_language.trim();
            const key = lang.toLowerCase();
            tagCounts[key] = (tagCounts[key] || 0) + 1;
            tagCategories[key] = tagCategories[key] || lang;
          }
        });

        // Also aggregate trending tech stacks from active developer profiles
        (profilesTech || []).forEach((prof) => {
          if (prof.tech_stack) {
            const techs = prof.tech_stack.split(/[,\s/]+/).map(t => t.trim()).filter(Boolean);
            techs.forEach((t) => {
              if (t.length > 2) {
                const key = t.toLowerCase();
                tagCounts[key] = (tagCounts[key] || 0) + 1;
                tagCategories[key] = tagCategories[key] || t;
              }
            });
          }
        });

        const sortedTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, count], idx) => {
            const displayTag = tagCategories[key] || key;
            return {
              tag: displayTag,
              count,
              posts: `${count} ${count === 1 ? 'post' : 'posts'}`,
              category: idx % 2 === 0 ? 'Trending' : 'Dev Topic',
              spark: getSparkPath(idx),
              color: getSparkColor(idx),
            };
          });

        setTrendingTags(sortedTags);


        // 2. Fetch Real Communities from 'communities' table
        const { data: commsData } = await supabase
          .from('communities')
          .select('id, name, icon, member_count')
          .order('member_count', { ascending: false })
          .limit(5);

        if (commsData && commsData.length > 0) {
          setCommunities(commsData);
        }

        // Fetch user memberships for communities
        if (profile?.id) {
          const { data: memberData } = await supabase
            .from('community_members')
            .select('community_id')
            .eq('user_id', profile.id);

          if (memberData) {
            setJoinedCommunities(new Set(memberData.map((m) => m.community_id)));
          }
        }

        // 3. Fetch Real Suggested Users from 'profiles' table
        if (profile?.id) {
          const { data: usersData } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url, tech_stack')
            .neq('id', profile.id)
            .limit(5);

          if (usersData) {
            setSuggestedUsers(usersData);
          }

          // Fetch active connection requests
          const { data: connsData } = await supabase
            .from('connections')
            .select('receiver_id, status')
            .eq('requester_id', profile.id);

          if (connsData) {
            setConnectedIds(new Set(connsData.map((c) => c.receiver_id)));
          }
        }
      } catch (err) {
        console.error('Error loading Rightbar DB data:', err);
      }
    };

    loadDatabaseData();
  }, [profile?.id]);

  const handleToggleCommunity = async (comm) => {
    if (!profile?.id) return;
    const isJoined = joinedCommunities.has(comm.id);

    try {
      if (isJoined) {
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', comm.id)
          .eq('user_id', profile.id);

        await supabase
          .from('communities')
          .update({ member_count: Math.max(0, (comm.member_count || 1) - 1) })
          .eq('id', comm.id);

        setJoinedCommunities((prev) => {
          const s = new Set(prev);
          s.delete(comm.id);
          return s;
        });

        setCommunities((prev) =>
          prev.map((c) => (c.id === comm.id ? { ...c, member_count: Math.max(0, (c.member_count || 1) - 1) } : c))
        );
        toast.success(`Left ${comm.name}`);
      } else {
        await supabase
          .from('community_members')
          .insert({ community_id: comm.id, user_id: profile.id });

        await supabase
          .from('communities')
          .update({ member_count: (comm.member_count || 0) + 1 })
          .eq('id', comm.id);

        setJoinedCommunities((prev) => new Set([...prev, comm.id]));
        setCommunities((prev) =>
          prev.map((c) => (c.id === comm.id ? { ...c, member_count: (c.member_count || 0) + 1 } : c))
        );
        toast.success(`Joined ${comm.name}!`);
      }
    } catch {
      toast.error('Failed to update community membership');
    }
  };

  const handleQuickConnect = async (targetId) => {
    if (!profile?.id) return;
    setConnectingId(targetId);
    try {
      const { error } = await supabase.from('connections').insert({
        requester_id: profile.id,
        receiver_id: targetId,
        status: 'pending',
      });
      if (!error) {
        setConnectedIds((prev) => new Set(prev).add(targetId));
        toast.success('Connection request sent!');
      } else {
        toast.info('Request already pending.');
        setConnectedIds((prev) => new Set(prev).add(targetId));
      }
    } catch {
      toast.error('Could not connect');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <aside className="sticky top-20 flex flex-col gap-3.5 w-full select-none">
      {/* 1. CyberSec & AI Daily Intel Brief */}
      <div className="bg-gradient-to-br from-[#fff7ed] to-[#fffdfa] border border-[#fed7aa] rounded-2xl p-3.5 flex flex-col gap-2 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#ea580c]">
            <Lock size={13} />
            <span>CyberSec & AI Intel</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#8d7565]">
          <strong className="text-[#2b1f17]">OWASP Tip:</strong> Prevent IDOR by validating session ownership on all Supabase RLS row policies.
        </p>
        <Link
          to="/events"
          className="text-[11px] font-bold text-[#ea580c] hover:underline flex items-center gap-1 mt-0.5"
        >
          Explore CTF & Security Events &rarr;
        </Link>
      </div>

      {/* 2. Trending Topics (Real Database Posts) */}
      <div className="bg-white border border-[#f1e4d3] shadow-xs rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#2b1f17] flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#ea580c]" />
            Trending Topics
          </h3>
          <span className="text-[10px] font-semibold text-[#8d7565]">Live</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {trendingTags.length === 0 ? (
            <div className="py-4 text-center text-xs text-[#8d7565]">
              No trending topics yet.<br />Include hashtags in your posts to trend!
            </div>
          ) : (
            trendingTags.map((item, idx) => (
              <div
                key={item.tag}
                onClick={() => navigate(`/search?q=${encodeURIComponent(item.tag)}`)}
                className="flex items-center justify-between group cursor-pointer p-1.5 rounded-xl hover:bg-[#fff7ed] transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-xs font-bold text-[#8d7565] w-2.5">{idx + 1}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#2b1f17] group-hover:text-[#ea580c] transition-colors">
                      #{item.tag}
                    </span>
                    <span className="text-[10px] text-[#8d7565]">
                      {item.category} · {item.posts}
                    </span>
                  </div>
                </div>

                {/* Sparkline */}
                <svg width="55" height="18" className="overflow-visible shrink-0">
                  <path
                    d={item.spark}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ))
          )}
        </div>

      </div>

      {/* 3. Communities (Real Database Table) */}
      {communities.length > 0 && (
        <div className="bg-white border border-[#f1e4d3] shadow-xs rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2b1f17]">Communities</h3>
            <Link
              to="/communities"
              className="text-[11px] font-bold text-[#ea580c] hover:underline transition-colors"
            >
              View all
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {communities.map((comm) => {
              const isJoined = joinedCommunities.has(comm.id);

              return (
                <div key={comm.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/communities/${comm.id}`}
                    className="flex items-center gap-2 min-w-0 flex-1 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#fff7ed] border border-[#fed7aa] flex items-center justify-center text-sm shrink-0">
                      {comm.icon || '💡'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#2b1f17] group-hover:text-[#ea580c] truncate transition-colors">
                        {comm.name}
                      </span>
                      <span className="text-[10px] text-[#8d7565] truncate">
                        {comm.member_count || 1} members
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleToggleCommunity(comm)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      isJoined
                        ? 'bg-[#faf6f0] text-[#8d7565] hover:text-[#2b1f17] border border-[#f1e4d3]'
                        : 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs hover:brightness-105'
                    }`}
                  >
                    {isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Suggested Developers (Real Database Table) */}
      {suggestedUsers.length > 0 && (
        <div className="bg-white border border-[#f1e4d3] shadow-xs rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2b1f17] flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" />
              Suggested Developers
            </h3>
            <Link
              to="/search"
              className="text-[11px] font-bold text-[#ea580c] hover:underline"
            >
              See All
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {suggestedUsers.map((user) => {
              const isSent = connectedIds.has(user.id);
              const isConnecting = connectingId === user.id;

              return (
                <div key={user.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/profile/${user.username}`}
                    className="flex items-center gap-2 min-w-0 flex-1 group"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] flex items-center justify-center font-bold text-xs text-white shrink-0 p-0.5">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        user.username?.[0]?.toUpperCase() || 'D'
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold truncate text-[#2b1f17] group-hover:text-[#ea580c] transition-colors">
                        {user.username}
                      </span>
                      <span className="block text-[10px] text-[#8d7565] truncate">
                        {user.tech_stack?.split(',')[0]?.trim() || user.bio || 'Developer'}
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleQuickConnect(user.id)}
                    disabled={isSent || isConnecting}
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer disabled:opacity-60 ${
                      isSent
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs hover:brightness-105'
                    }`}
                  >
                    {isConnecting ? (
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isSent ? (
                      <><CheckCircle2 size={12} /> Sent</>
                    ) : (
                      <><UserPlus size={12} /> Connect</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-2 pb-1 text-[10px] flex items-center justify-between text-[#8d7565]">
        <span>Connectra v2.0 · AI & Security</span>
        <span>© 2026</span>
      </div>
    </aside>
  );
}
