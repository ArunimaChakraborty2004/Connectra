import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { Search, UserPlus, UserCheck, UserMinus, UserX, Clock, Filter, MoreVertical, Flag, ShieldBan, ShieldCheck, Lock, Check } from 'lucide-react';
import Loader from '../components/ui/Loader';
import { toast } from '../lib/toast';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createNotification } from '../lib/notifications';

export default function SearchPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlTab = searchParams.get('tab') || 'all';
  const [query, setQuery] = useState(urlQuery);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState({});
  const [activeFilter, setActiveFilter] = useState(urlTab);
  const [blockedUserIds, setBlockedUserIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`blocked_users_${session.user.id}`) || '[]');
    } catch {
      return [];
    }
  });
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [reportModalUser, setReportModalUser] = useState(null);
  const [reportReason, setReportReason] = useState('Spam or misleading information');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Sync local state when URL parameter changes
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (urlTab && ['all', 'following', 'followers', 'blocked'].includes(urlTab)) {
      setActiveFilter(urlTab);
    }
  }, [urlTab]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(data || { id: session.user.id, username: 'User' });
    };
    loadProfile();
  }, [session]);

  // Follow relationships (Instagram style)
  const [followingMap, setFollowingMap] = useState({}); // userIds I follow
  const [followersMap, setFollowersMap] = useState({}); // userIds who follow me

  // Load all follow relationships for current user
  const loadFollows = async () => {
    try {
      // 1. People I am following
      const { data: myFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id);

      // 2. People following me
      const { data: myFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id);

      const fIngMap = {};
      (myFollowing || []).forEach(f => { fIngMap[f.following_id] = true; });

      const fErsMap = {};
      (myFollowers || []).forEach(f => { fErsMap[f.follower_id] = true; });

      setFollowingMap(fIngMap);
      setFollowersMap(fErsMap);
    } catch (err) {
      console.warn('Error loading follows:', err);
    }
  };



  useEffect(() => {
    loadFollows();
  }, [session.user.id]);

  const handleFollow = async (targetId) => {
    // Instant optimistic update
    setFollowingMap(prev => ({ ...prev, [targetId]: true }));
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: session.user.id, following_id: targetId });

    if (error) {
      toast.error(error.message);
      setFollowingMap(prev => { const n = { ...prev }; delete n[targetId]; return n; });
    } else {
      toast.success('Following developer!');
      createNotification({
        userId: targetId,
        actorId: session.user.id,
        type: 'follow',
        entityId: targetId,
      });
      // Dispatch event to refresh sidebar stats
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const handleUnfollow = async (targetId) => {
    setFollowingMap(prev => { const n = { ...prev }; delete n[targetId]; return n; });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('following_id', targetId);

    if (error) {
      toast.error(error.message);
      setFollowingMap(prev => ({ ...prev, [targetId]: true }));
    } else {
      toast.info('Unfollowed');
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const handleRemoveFollower = async (targetId) => {
    setFollowersMap(prev => { const n = { ...prev }; delete n[targetId]; return n; });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', targetId)
      .eq('following_id', session.user.id);

    if (error) {
      toast.error(error.message);
      setFollowersMap(prev => ({ ...prev, [targetId]: true }));
    } else {
      toast.info('Removed from followers');
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const followingCount = Object.keys(followingMap).length;
  const followersCount = Object.keys(followersMap).length;

  const filters = [
    { id: 'all', label: `All Devs (${users.filter(u => !blockedUserIds.includes(u.id)).length})` },
    { id: 'following', label: `Following (${followingCount})` },
    { id: 'followers', label: `Followers (${followersCount})` },
    ...(blockedUserIds.length > 0 ? [{ id: 'blocked', label: `Blocked (${blockedUserIds.length})` }] : []),
  ];

  const filteredUsers = users.filter(user => {
    const isBlocked = blockedUserIds.includes(user.id);
    if (activeFilter === 'blocked') return isBlocked;
    if (isBlocked) return false;
    if (activeFilter === 'following') return Boolean(followingMap[user.id]);
    if (activeFilter === 'followers') return Boolean(followersMap[user.id]);
    return true;
  });

  useEffect(() => {
    const searchUsers = async () => {
      setLoading(true);

      const cleanQuery = query.trim().replace(/^#/, '');

      try {
        let result = [];
        if (cleanQuery) {
          // Universal search across username, full_name, tech_stack, and bio directly from Supabase
          const { data: byName } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', session.user.id)
            .or(`username.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%,tech_stack.ilike.%${cleanQuery}%,bio.ilike.%${cleanQuery}%`)
            .limit(30);

          result = byName || [];
        } else {
          // No query: show all developers in Supabase
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', session.user.id)
            .limit(40);

          result = data || [];
        }

        // Normalize display name and attach privacy status
        const normalized = (result || []).map(u => ({
          ...u,
          isPrivate: u.is_private !== undefined ? Boolean(u.is_private) : localStorage.getItem(`connectra_private_${u.id}`) === 'true',
          displayName: u.username || u.full_name || `Developer_${u.id.slice(0, 5)}`,
          profileSlug: u.username || u.id,
        }));

        setUsers(normalized);
      } catch (err) {
        console.error('Search error:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 250);
    return () => clearTimeout(debounce);
  }, [query, session.user.id]);

  const handleBlockUser = (userId, displayName) => {
    const nextBlocked = [...new Set([...blockedUserIds, userId])];
    setBlockedUserIds(nextBlocked);
    localStorage.setItem(`blocked_users_${session.user.id}`, JSON.stringify(nextBlocked));
    setActiveActionMenu(null);
    toast.info(`Blocked ${displayName}. They won't appear in your search.`);
  };

  const handleUnblockUser = (userId) => {
    const nextBlocked = blockedUserIds.filter(id => id !== userId);
    setBlockedUserIds(nextBlocked);
    localStorage.setItem(`blocked_users_${session.user.id}`, JSON.stringify(nextBlocked));
    toast.success('Developer unblocked');
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportModalUser) return;
    setSubmittingReport(true);

    try {
      // Store in audit_logs or analytics_events if available, with graceful fallback
      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        action: 'report_user',
        entity_type: 'profile',
        entity_id: reportModalUser.id,
        metadata: {
          reason: reportReason,
          details: reportDetails,
          reported_username: reportModalUser.displayName,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.warn('Audit log report fallback:', err);
    }

    setSubmittingReport(false);
    toast.success(`Report submitted for ${reportModalUser.displayName}. Our safety team has been notified.`);
    setReportModalUser(null);
    setReportDetails('');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}>
      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          {profile ? (
            <Sidebar profile={profile} stats={{ followers: followersCount, following: followingCount }} />
          ) : (
            <Loader />
          )}
        </div>


        <div className="flex-1 w-full max-w-2xl">
          {/* Search Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-color)' }}>
              Find Developers
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Connect with engineers, designers, and builders on Connectra
            </p>
          </div>

          {/* Search Bar */}
          <div className="glass-panel rounded-2xl p-4 mb-4">
            <div className="relative">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2"
                size={18}
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search by username, skill (e.g. React, CyberSec, Python)..."
                className="w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary-color)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 mb-5">
            <Filter size={14} style={{ color: 'var(--text-muted)', marginTop: 6 }} />
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: activeFilter === f.id ? 'var(--primary-color)' : 'var(--surface-color)',
                  color: activeFilter === f.id ? '#fff' : 'var(--text-muted)',
                  border: '1px solid ' + (activeFilter === f.id ? 'var(--primary-color)' : 'var(--border-color)'),
                }}
              >
                {f.label}
              </button>
            ))}
            {loading && (
              <span className="text-xs ml-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin inline-block" />
                Searching...
              </span>
            )}
          </div>

          {/* Results */}
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {loading && users.length === 0 ? (
                <Loader key="loader" />
              ) : filteredUsers.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
                  >
                    <Search size={28} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-color)' }}>
                    {activeFilter === 'following'
                      ? 'Not following anyone yet'
                      : activeFilter === 'followers'
                      ? 'No followers yet'
                      : query
                      ? `No developers match "${query}"`
                      : 'No developers found'}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {activeFilter === 'following'
                      ? 'Explore developers and click "Follow" or "Follow Back" to stay connected!'
                      : activeFilter === 'followers'
                      ? 'Share your projects and profile to gain followers in the community.'
                      : query
                      ? 'Try a different username, full name, or skill keyword'
                      : 'Explore developers and start networking!'}
                  </p>
                </motion.div>
              ) : (
                filteredUsers.map((user, i) => {
                  const conn = connections[user.id];
                  const status = conn?.status;

                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.18, delay: i * 0.04 }}
                      className="glass-panel rounded-2xl p-4 flex items-center gap-4 transition-all"
                      style={{ '--tw-border-opacity': 1 }}
                    >
                      {/* Avatar */}
                      <Link
                        to={`/profile/${encodeURIComponent(user.profileSlug || user.displayName)}`}
                        className="shrink-0"
                      >
                        <div
                          className="h-13 w-13 rounded-xl flex items-center justify-center text-base font-bold overflow-hidden border"
                          style={{
                            width: 52,
                            height: 52,
                            backgroundColor: 'var(--surface-hover)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--primary-color)',
                          }}
                        >
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{user.displayName?.[0]?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                      </Link>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/profile/${encodeURIComponent(user.profileSlug || user.displayName)}`}
                            className="font-bold text-[15px] hover:underline block truncate transition-colors"
                            style={{ color: 'var(--text-color)' }}
                            onMouseEnter={e => e.target.style.color = 'var(--primary-color)'}
                            onMouseLeave={e => e.target.style.color = 'var(--text-color)'}
                          >
                            {user.displayName}
                          </Link>
                          {user.isPrivate && (
                            <span
                              className="text-[10px] flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-color)',
                              }}
                              title="Private Profile (Details visible to connections only)"
                            >
                              <Lock size={10} /> Private
                            </span>
                          )}
                        </div>
                        {user.isPrivate && status !== 'accepted' ? (
                          <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                            🔒 Profile details are private. Connect to view tech stack and repositories.
                          </p>
                        ) : (
                          <>
                            {user.bio && (
                              <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {user.bio}
                              </p>
                            )}
                            {user.tech_stack && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {user.tech_stack.split(',').slice(0, 4).map((tech, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                                    style={{
                                      backgroundColor: 'var(--surface-hover)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {tech.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Actions & Moderation */}
                      <div className="flex items-center gap-2 shrink-0 relative">
                        {blockedUserIds.includes(user.id) ? (
                          <button
                            onClick={() => handleUnblockUser(user.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                            style={{
                              backgroundColor: 'rgba(16,185,129,0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.3)',
                            }}
                          >
                            <ShieldCheck size={13} /> Unblock
                          </button>
                        ) : (() => {
                          const isFollowing = Boolean(followingMap[user.id]);
                          const isFollower = Boolean(followersMap[user.id]);

                          if (isFollowing) {
                            return (
                              <button
                                onClick={() => handleUnfollow(user.id)}
                                className="group px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border"
                                style={{
                                  backgroundColor: 'var(--surface-hover)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--text-color)',
                                }}
                                title="Click to Unfollow"
                              >
                                <span className="group-hover:hidden flex items-center gap-1.5 text-emerald-400">
                                  <UserCheck size={13} /> Following
                                </span>
                                <span className="hidden group-hover:flex items-center gap-1.5 text-rose-400">
                                  <UserMinus size={13} /> Unfollow
                                </span>
                              </button>
                            );
                          }

                          if (isFollower) {
                            return (
                              <button
                                onClick={() => handleFollow(user.id)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-white bg-indigo-600 hover:bg-indigo-500"
                                title="Follow back this developer"
                              >
                                <UserPlus size={13} /> Follow Back
                              </button>
                            );
                          }

                          return (
                            <button
                              onClick={() => handleFollow(user.id)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-white"
                              style={{ backgroundColor: 'var(--primary-color)' }}
                              title="Follow developer"
                            >
                              <UserPlus size={13} /> Follow
                            </button>
                          );
                        })()}

                        {/* More Menu (Remove Follower / Report / Block) */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveActionMenu(activeActionMenu === user.id ? null : user.id)}
                            aria-label="User options"
                            className="p-2 rounded-xl transition-colors cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                              e.currentTarget.style.color = 'var(--text-color)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeActionMenu === user.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-44 rounded-xl py-1.5 shadow-xl z-30 border"
                              style={{
                                backgroundColor: 'var(--surface-color)',
                                borderColor: 'var(--border-color)',
                              }}
                            >
                              {Boolean(followersMap[user.id]) && (
                                <button
                                  onClick={() => {
                                    setActiveActionMenu(null);
                                    handleRemoveFollower(user.id);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer text-rose-400 hover:bg-rose-500/10"
                                >
                                  <UserX size={13} /> Remove Follower
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  setReportModalUser(user);
                                }}
                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer"
                                style={{ color: '#f59e0b' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Flag size={13} /> Report User
                              </button>

                              <button
                                onClick={() => handleBlockUser(user.id, user.displayName)}
                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer"
                                style={{ color: '#ef4444' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <ShieldBan size={13} /> Block User
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Results count */}
          {!loading && filteredUsers.length > 0 && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              Showing {filteredUsers.length} developer{filteredUsers.length !== 1 ? 's' : ''}
              {query ? ` matching "${query}"` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {reportModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl max-w-md w-full p-6 shadow-2xl border"
              style={{
                backgroundColor: 'var(--surface-color)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center gap-2.5 mb-3 text-amber-500">
                <Flag size={20} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>
                  Report {reportModalUser.displayName}
                </h3>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Help keep Connectra safe. Tell us why you are flagging this profile.
              </p>

              <form onSubmit={handleReportSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-color)' }}>
                    Reason for report
                  </label>
                  <select
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none border transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-color)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-color)',
                    }}
                  >
                    <option value="Spam or misleading information">Spam or misleading information</option>
                    <option value="Harassment or abusive behavior">Harassment or abusive behavior</option>
                    <option value="Inappropriate or malicious code snippet">Inappropriate or malicious code snippet</option>
                    <option value="Fake or impersonated profile">Fake or impersonated profile</option>
                    <option value="Other security/safety violation">Other security/safety violation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: 'var(--text-color)' }}>
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                    rows={3}
                    placeholder="Provide any additional context or proof..."
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none border resize-none transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-color)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-color)',
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
