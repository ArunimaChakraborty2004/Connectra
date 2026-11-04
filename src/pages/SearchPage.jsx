import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/feed/PostCard';
import {
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  UserX,
  Clock,
  Filter,
  MoreVertical,
  Flag,
  ShieldBan,
  ShieldCheck,
  Lock,
  Check,
  SlidersHorizontal,
  X,
  Sparkles,
  FileText,
  Users,
  Tag,
  ArrowUpDown,
  RotateCcw,
  ChevronDown,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import Loader from '../components/ui/Loader';
import { toast } from '../lib/toast';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createNotification } from '../lib/notifications';

const POPULAR_SKILLS = [
  'React',
  'Python',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Next.js',
  'AI / ML',
  'CyberSec',
  'Rust',
  'Go',
  'Tailwind',
  'Docker',
  'AWS',
  'PostgreSQL',
];

const parseTechStack = (techStack) => {
  if (!techStack) return [];
  if (Array.isArray(techStack)) return techStack.map((t) => String(t).trim()).filter(Boolean);
  if (typeof techStack === 'string') {
    return techStack.split(/[,|/]+/).map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

// Calculate search relevance score: higher means better match
const getMatchScore = (user, q) => {
  if (!q || !user) return 0;
  const lowerQ = q.toLowerCase();
  const uname = (user.username || '').toLowerCase();
  const fname = (user.full_name || '').toLowerCase();
  const dname = (user.displayName || '').toLowerCase();
  const tech = (Array.isArray(user.tech_stack) ? user.tech_stack.join(' ') : (user.tech_stack || '')).toLowerCase();
  const bio = (user.bio || '').toLowerCase();

  // 1. Exact match on username: score 100
  if (uname === lowerQ) return 100;
  // 2. Starts with query: highest priority prefix match (e.g. typing 'p' matches 'prachi')
  if (uname.startsWith(lowerQ)) return 85;
  if (fname.startsWith(lowerQ)) return 75;
  if (dname.startsWith(lowerQ)) return 70;
  // 3. Substring match
  if (uname.includes(lowerQ)) return 50;
  if (fname.includes(lowerQ)) return 40;
  if (dname.includes(lowerQ)) return 35;
  if (tech.includes(lowerQ)) return 25;
  if (bio.includes(lowerQ)) return 15;
  return 0;
};

// Highlight matched query letters in text
const highlightMatch = (text, q) => {
  if (!q || !text) return text;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return str;
  return (
    <>
      {str.slice(0, idx)}
      <span className="text-orange-500 font-extrabold underline decoration-orange-500/50">
        {str.slice(idx, idx + q.length)}
      </span>
      {str.slice(idx + q.length)}
    </>
  );
};

export default function SearchPage({ session }) {
  const navigate = useNavigate();
  const currentUserId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlTab = searchParams.get('tab') || 'all';

  const [query, setQuery] = useState(urlQuery);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState({});

  // Typeahead suggestions popup state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allProfilesCache, setAllProfilesCache] = useState([]);
  const searchContainerRef = useRef(null);

  // Filter states
  const [contentType, setContentType] = useState('all'); // 'all' | 'devs' | 'posts'
  const [selectedSkill, setSelectedSkill] = useState(null); // string e.g. 'React'
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'xp' | 'newest' | 'followers'
  const [activeFilter, setActiveFilter] = useState(urlTab); // 'all' | 'following' | 'followers' | 'blocked'
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [blockedUserIds, setBlockedUserIds] = useState(() => {
    try {
      if (!currentUserId) return [];
      return JSON.parse(localStorage.getItem(`blocked_users_${currentUserId}`) || '[]');
    } catch {
      return [];
    }
  });

  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [reportModalUser, setReportModalUser] = useState(null);
  const [reportReason, setReportReason] = useState('Spam or misleading information');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Pre-load all available profiles once on mount for instant zero-latency popup
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .limit(80)
      .then(({ data }) => {
        if (data) {
          const norm = data.map((u) => ({
            ...u,
            displayName: u.username || u.full_name || (u.id ? `Developer_${u.id.slice(0, 5)}` : 'Developer'),
            profileSlug: u.username || u.id || 'developer',
          }));
          setAllProfilesCache(norm);
        }
      });
  }, []);

  // Click outside listener to close floating typeahead suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state when URL parameter changes
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (urlTab && ['all', 'following', 'followers', 'blocked'].includes(urlTab)) {
      setActiveFilter(urlTab);
    }
  }, [urlTab]);

  // Escape key handler: clear query or close hub & go back to feed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        if (query) {
          setQuery('');
          setSearchParams({});
        } else {
          navigate('/');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, navigate, setSearchParams]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowSuggestions(true);
    if (val.trim()) {
      setSearchParams({ q: val });
    } else {
      setSearchParams({});
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    } else {
      setSearchParams({});
    }
    loadAllResults();
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUserId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .single();
        if (data && !error) {
          setProfile(data);
        } else {
          setProfile({ id: currentUserId, username: session?.user?.email?.split('@')[0] || 'User' });
        }
      } catch {
        setProfile({ id: currentUserId, username: 'User' });
      }
    };
    loadProfile();
  }, [currentUserId]);

  // Follow relationships
  const [followingMap, setFollowingMap] = useState({});
  const [followersMap, setFollowersMap] = useState({});

  const loadFollows = async () => {
    if (!currentUserId) return;
    try {
      const { data: myFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const { data: myFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUserId);

      const fIngMap = {};
      (myFollowing || []).forEach((f) => {
        if (f.following_id) fIngMap[f.following_id] = true;
      });

      const fErsMap = {};
      (myFollowers || []).forEach((f) => {
        if (f.follower_id) fErsMap[f.follower_id] = true;
      });

      setFollowingMap(fIngMap);
      setFollowersMap(fErsMap);
    } catch (err) {
      console.warn('Error loading follows:', err);
    }
  };

  useEffect(() => {
    loadFollows();
  }, [currentUserId]);

  const handleFollow = async (targetId) => {
    if (!currentUserId || !targetId) return;
    setFollowingMap((prev) => ({ ...prev, [targetId]: true }));
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: currentUserId, following_id: targetId });

    if (error) {
      toast.error(error.message);
      setFollowingMap((prev) => {
        const n = { ...prev };
        delete n[targetId];
        return n;
      });
    } else {
      toast.success('Following developer!');
      createNotification({
        userId: targetId,
        actorId: currentUserId,
        type: 'follow',
        entityId: targetId,
      });
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const handleUnfollow = async (targetId) => {
    if (!currentUserId || !targetId) return;
    setFollowingMap((prev) => {
      const n = { ...prev };
      delete n[targetId];
      return n;
    });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetId);

    if (error) {
      toast.error(error.message);
      setFollowingMap((prev) => ({ ...prev, [targetId]: true }));
    } else {
      toast.info('Unfollowed');
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const handleRemoveFollower = async (targetId) => {
    if (!currentUserId || !targetId) return;
    setFollowersMap((prev) => {
      const n = { ...prev };
      delete n[targetId];
      return n;
    });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', targetId)
      .eq('following_id', currentUserId);

    if (error) {
      toast.error(error.message);
      setFollowersMap((prev) => ({ ...prev, [targetId]: true }));
    } else {
      toast.info('Removed from followers');
      window.dispatchEvent(new Event('refreshStats'));
    }
  };

  const followingCount = Object.keys(followingMap).length;
  const followersCount = Object.keys(followersMap).length;

  // Search execution for both developers and posts
  const loadAllResults = async () => {
    setLoading(true);
    const cleanQuery = query.trim().replace(/^#/, '');

    try {
      // 1. Fetch Developers
      let result = [];
      if (cleanQuery) {
        let q = supabase.from('profiles').select('*');
        if (currentUserId) {
          q = q.neq('id', currentUserId);
        }
        const safeQuery = cleanQuery.replace(/[,()]/g, ' ').trim();
        const { data: byName, error: searchError } = await q
          .or(
            `username.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%,bio.ilike.%${safeQuery}%`
          )
          .limit(40);

        if (searchError || !byName || byName.length === 0) {
          let fb = supabase.from('profiles').select('*');
          if (currentUserId) fb = fb.neq('id', currentUserId);
          const { data: fallbackUsers } = await fb
            .ilike('username', `%${safeQuery}%`)
            .limit(40);
          result = fallbackUsers || [];
        } else {
          result = byName;
        }
      } else {
        let q = supabase.from('profiles').select('*');
        if (currentUserId) {
          q = q.neq('id', currentUserId);
        }
        const { data, error } = await q.limit(40);
        if (error) {
          console.warn('Error fetching profiles:', error);
        }
        result = data || [];
      }

      const normalized = (result || []).map((u) => ({
        ...u,
        isPrivate:
          u.is_private !== undefined
            ? Boolean(u.is_private)
            : u.id
            ? localStorage.getItem(`connectra_private_${u.id}`) === 'true'
            : false,
        displayName: u.username || u.full_name || (u.id ? `Developer_${u.id.slice(0, 5)}` : 'Developer'),
        profileSlug: u.username || u.id || 'developer',
      }));

      setUsers(normalized);

      // 2. Fetch Matching Posts if searching or filtering by posts / all
      if (contentType === 'all' || contentType === 'posts') {
        setLoadingPosts(true);
        let pQuery = supabase
          .from('posts')
          .select(`
            id, user_id, content, image_url, code_snippet, code_language, created_at, updated_at,
            profiles(username, avatar_url)
          `)
          .order('created_at', { ascending: false });

        if (cleanQuery) {
          pQuery = pQuery.or(`content.ilike.%${cleanQuery}%,code_language.ilike.%${cleanQuery}%`);
        }
        if (selectedSkill) {
          pQuery = pQuery.ilike('content', `%${selectedSkill}%`);
        }

        const { data: postsData } = await pQuery.limit(20);

        if (postsData && postsData.length > 0) {
          const postIds = postsData.map((p) => p.id);
          const [{ data: likesData }, { data: commentsData }] = await Promise.all([
            supabase.from('likes').select('id, post_id, user_id').in('post_id', postIds),
            supabase
              .from('comments')
              .select('id, post_id, user_id, content, created_at, profiles(username, avatar_url)')
              .in('post_id', postIds)
              .order('created_at', { ascending: true }),
          ]);

          const likesCountMap = {};
          const userLikedMap = {};
          (likesData || []).forEach((l) => {
            likesCountMap[l.post_id] = (likesCountMap[l.post_id] || 0) + 1;
            if (currentUserId && l.user_id === currentUserId) {
              userLikedMap[l.post_id] = true;
            }
          });

          const commentsCountMap = {};
          const commentsByPost = {};
          (commentsData || []).forEach((c) => {
            commentsCountMap[c.post_id] = (commentsCountMap[c.post_id] || 0) + 1;
            if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
            commentsByPost[c.post_id].push(c);
          });

          const formattedPosts = postsData.map((p) => ({
            ...p,
            likes: [{ count: likesCountMap[p.id] || 0 }],
            likes_count: likesCountMap[p.id] || 0,
            user_has_liked: Boolean(userLikedMap[p.id]),
            comments_count: commentsCountMap[p.id] || 0,
            comments: commentsByPost[p.id] || [],
            author: p.profiles?.username || 'developer',
            author_avatar: p.profiles?.avatar_url,
          }));

          setPosts(formattedPosts);
        } else {
          setPosts([]);
        }
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setUsers([]);
      setPosts([]);
    } finally {
      setLoading(false);
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(loadAllResults, 250);
    return () => clearTimeout(debounce);
  }, [query, currentUserId, contentType, selectedSkill]);

  // Filter developers based on active filters and sorting
  let filteredUsers = users.filter((user) => {
    if (!user || !user.id) return false;
    if (currentUserId && user.id === currentUserId) return false;
    const isBlocked = blockedUserIds.includes(user.id);
    if (activeFilter === 'blocked') return isBlocked;
    if (isBlocked) return false;
    if (activeFilter === 'following') return Boolean(followingMap[user.id]);
    if (activeFilter === 'followers') return Boolean(followersMap[user.id]);

    // Skill filter on developer tech_stack or bio
    if (selectedSkill) {
      const skillNorm = selectedSkill.toLowerCase();
      const techStr = Array.isArray(user.tech_stack)
        ? user.tech_stack.join(' ').toLowerCase()
        : typeof user.tech_stack === 'string'
        ? user.tech_stack.toLowerCase()
        : '';
      const bioStr = typeof user.bio === 'string' ? user.bio.toLowerCase() : '';
      if (!techStr.includes(skillNorm) && !bioStr.includes(skillNorm)) {
        return false;
      }
    }

    return true;
  });

  // Compute instant matching suggestions for typeahead dropdown
  const cleanQ = query.trim().replace(/^#/, '');
  const candidatePool = allProfilesCache.length > 0 ? allProfilesCache : users;
  const instantSuggestions = cleanQ
    ? candidatePool
        .filter((u) => u && u.id && u.id !== currentUserId && getMatchScore(u, cleanQ) > 0)
        .sort((a, b) => getMatchScore(b, cleanQ) - getMatchScore(a, cleanQ))
        .slice(0, 6)
    : [];

  // Sort developers
  if (sortBy === 'relevance' && cleanQ) {
    filteredUsers = [...filteredUsers].sort(
      (a, b) => getMatchScore(b, cleanQ) - getMatchScore(a, cleanQ)
    );
  } else if (sortBy === 'xp') {
    filteredUsers = [...filteredUsers].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  } else if (sortBy === 'newest') {
    filteredUsers = [...filteredUsers].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  } else if (sortBy === 'followers') {
    filteredUsers = [...filteredUsers].sort(
      (a, b) => (Boolean(followersMap[b.id]) ? 1 : 0) - (Boolean(followersMap[a.id]) ? 1 : 0)
    );
  }

  // Active filter count for badge indicator
  let activeFilterCount = 0;
  if (contentType !== 'all') activeFilterCount++;
  if (selectedSkill) activeFilterCount++;
  if (sortBy !== 'relevance') activeFilterCount++;
  if (activeFilter !== 'all') activeFilterCount++;

  const resetAllFilters = () => {
    setContentType('all');
    setSelectedSkill(null);
    setSortBy('relevance');
    setActiveFilter('all');
    toast.info('All search filters reset');
  };

  const handleBlockUser = (userId, displayName) => {
    const nextBlocked = [...new Set([...blockedUserIds, userId])];
    setBlockedUserIds(nextBlocked);
    if (currentUserId) {
      localStorage.setItem(`blocked_users_${currentUserId}`, JSON.stringify(nextBlocked));
    }
    setActiveActionMenu(null);
    toast.info(`Blocked ${displayName}. They won't appear in your search.`);
  };

  const handleUnblockUser = (userId) => {
    const nextBlocked = blockedUserIds.filter((id) => id !== userId);
    setBlockedUserIds(nextBlocked);
    if (currentUserId) {
      localStorage.setItem(`blocked_users_${currentUserId}`, JSON.stringify(nextBlocked));
    }
    toast.success('Developer unblocked');
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportModalUser) return;
    setSubmittingReport(true);

    try {
      if (currentUserId) {
        await supabase.from('audit_logs').insert({
          user_id: currentUserId,
          action: 'report_user',
          entity_type: 'profile',
          entity_id: reportModalUser.id,
          metadata: {
            reason: reportReason,
            details: reportDetails,
            reported_username: reportModalUser.displayName,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.warn('Audit log report fallback:', err);
    }

    setSubmittingReport(false);
    toast.success(
      `Report submitted for ${reportModalUser.displayName}. Our safety team has been notified.`
    );
    setReportModalUser(null);
    setReportDetails('');
  };

  const typeTabs = [
    { id: 'all', label: 'All Results', icon: Sparkles, count: filteredUsers.length + posts.length },
    { id: 'devs', label: 'Developers', icon: Users, count: filteredUsers.length },
    { id: 'posts', label: 'Posts & Feed', icon: FileText, count: posts.length },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8 relative items-start justify-center z-10">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-full max-w-[300px] shrink-0">
          <Sidebar
            profile={profile || { id: currentUserId, username: session?.user?.email?.split('@')[0] || 'User' }}
            stats={{ followers: followersCount, following: followingCount }}
          />
        </div>

        {/* Center Search Hub */}
        <div className="flex-1 w-full max-w-2xl">
          {/* Header with Close Hub Cross Mark */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>
                  Search & Explore
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  Dev Hub
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Discover engineers, tech discussions, code snippets, and skills across Connectra
              </p>
            </div>

            {/* Cross mark to close/stop the Search Hub and return to Feed */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3 py-2 rounded-xl border transition-all cursor-pointer hover:border-orange-500 hover:bg-orange-500/10 text-muted hover:text-white shrink-0 flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              style={{
                backgroundColor: 'var(--surface-color)',
                borderColor: 'var(--border-color)',
              }}
              title="Close Search Hub & Return to Feed (Esc)"
              aria-label="Close Search Hub"
            >
              <X size={15} className="text-orange-500" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>

          {/* Search Bar & Working Filter Hub */}
          <form
            onSubmit={handleSearchSubmit}
            className="glass-panel rounded-2xl p-3 sm:p-4 mb-4 shadow-sm"
            style={{ border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center gap-2">
              {/* Input field with ref for click-outside detection */}
              <div className="relative flex-1" ref={searchContainerRef}>
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  size={18}
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => {
                    if (query.trim()) setShowSuggestions(true);
                  }}
                  placeholder="Search by username, skill (e.g. React, CyberSec), or topic..."
                  className="w-full rounded-xl pl-10 pr-9 py-2.5 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-color)',
                    border: '1px solid var(--border-color)',
                  }}
                  onFocusCapture={(e) => (e.target.style.borderColor = 'var(--primary-color)')}
                  onBlurCapture={(e) => (e.target.style.borderColor = 'var(--border-color)')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSearchParams({});
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted hover:text-white transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}

                {/* Instant Typeahead Suggestions Dropdown Popup */}
                <AnimatePresence>
                  {showSuggestions && cleanQ && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl border backdrop-blur-2xl overflow-hidden"
                      style={{
                        backgroundColor: 'var(--surface-color)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      {/* Header */}
                      <div
                        className="p-2.5 px-3.5 border-b flex items-center justify-between text-xs"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <span className="font-semibold text-orange-500 flex items-center gap-1.5">
                          <Users size={14} />
                          Matching Developers ({instantSuggestions.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(false)}
                          className="text-muted hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                          title="Close suggestions"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      {/* Suggestions List */}
                      {instantSuggestions.length > 0 ? (
                        <div
                          className="py-1 max-h-72 overflow-y-auto divide-y"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {instantSuggestions.map((user) => {
                            const avatar = user.avatar_url;
                            const tech = parseTechStack(user.tech_stack);
                            return (
                              <div
                                key={user.id}
                                className="p-2.5 px-3.5 flex items-center justify-between gap-3 hover:bg-orange-500/10 transition-colors cursor-pointer group"
                                onClick={() => {
                                  setShowSuggestions(false);
                                  navigate(`/${user.profileSlug}`);
                                }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-orange-500 to-amber-500 p-0.5 shrink-0 flex items-center justify-center">
                                    {avatar ? (
                                      <img
                                        src={avatar}
                                        alt={user.displayName}
                                        className="w-full h-full object-cover rounded-full"
                                      />
                                    ) : (
                                      <div className="w-full h-full rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold">
                                        {(user.displayName || 'U')[0].toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 text-left">
                                    <div
                                      className="text-sm font-semibold truncate flex items-center gap-1.5"
                                      style={{ color: 'var(--text-color)' }}
                                    >
                                      {highlightMatch(user.full_name || user.displayName, cleanQ)}
                                    </div>
                                    <div className="text-xs text-orange-500/90 font-mono truncate">
                                      @{highlightMatch(user.username || user.profileSlug, cleanQ)}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {tech[0] && (
                                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                                      {tech[0]}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowSuggestions(false);
                                      navigate(`/chat?user=${user.id}`);
                                    }}
                                    className="p-1.5 rounded-lg border hover:border-orange-500 hover:bg-orange-500/10 text-muted hover:text-orange-500 transition-colors cursor-pointer"
                                    style={{ borderColor: 'var(--border-color)' }}
                                    title={`Message @${user.username}`}
                                  >
                                    <MessageSquare size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowSuggestions(false);
                                      navigate(`/${user.profileSlug}`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-xs cursor-pointer"
                                  >
                                    View
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                          No developer matches for &ldquo;<span className="text-orange-500 font-bold">{cleanQ}</span>&rdquo;.<br />
                          Press Enter to search all posts, feed, and discussions.
                        </div>
                      )}

                      {/* Footer */}
                      <div
                        className="p-2.5 px-3.5 border-t flex items-center justify-between text-[11px] cursor-pointer hover:bg-orange-500/10 transition-colors"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                        onClick={handleSearchSubmit}
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={12} className="text-orange-500" />
                          Press <kbd className="px-1.5 py-0.5 rounded bg-black/20 font-mono text-[10px] border border-white/10">Enter</kbd> to search everything
                        </span>
                        <span className="text-orange-500 font-semibold hover:underline">
                          See all results &rarr;
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Working Filter Button */}
              <button
                type="button"
                onClick={() => setShowFilterPanel((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
                  showFilterPanel || activeFilterCount > 0
                    ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500 text-orange-500 font-bold shadow-xs'
                    : 'bg-[var(--surface-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-[var(--primary-color)]'
                }`}
                title="Toggle search filters"
              >
                <SlidersHorizontal size={15} className={activeFilterCount > 0 ? 'text-orange-500' : ''} />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="w-4.5 h-4.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${showFilterPanel ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Search Submit Button */}
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm shadow-orange-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <Search size={15} />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            {/* Expandable Filter Drawer Panel */}
            <AnimatePresence>
              {showFilterPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pt-4 mt-3 border-t flex flex-col gap-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {/* Category Type */}
                  <div>
                    <label
                      className="text-xs font-bold block mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--text-color)' }}
                    >
                      <Sparkles size={13} className="text-orange-500" /> Content Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {typeTabs.map((t) => {
                        const Icon = t.icon;
                        const isSel = contentType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setContentType(t.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border"
                            style={{
                              backgroundColor: isSel
                                ? 'var(--primary-color)'
                                : 'var(--surface-color)',
                              color: isSel ? '#fff' : 'var(--text-muted)',
                              borderColor: isSel ? 'var(--primary-color)' : 'var(--border-color)',
                            }}
                          >
                            <Icon size={13} />
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skills & Tech Filter */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        className="text-xs font-bold flex items-center gap-1.5"
                        style={{ color: 'var(--text-color)' }}
                      >
                        <Tag size={13} className="text-amber-500" /> Filter by Skill / Tech
                      </label>
                      {selectedSkill && (
                        <button
                          type="button"
                          onClick={() => setSelectedSkill(null)}
                          className="text-[11px] text-orange-500 hover:underline cursor-pointer"
                        >
                          Clear Skill
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_SKILLS.map((skill) => {
                        const isSel = selectedSkill === skill;
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => setSelectedSkill(isSel ? null : skill)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                            style={{
                              backgroundColor: isSel
                                ? 'rgba(234, 88, 12, 0.15)'
                                : 'var(--surface-color)',
                              borderColor: isSel ? 'var(--primary-color)' : 'var(--border-color)',
                              color: isSel ? 'var(--primary-color)' : 'var(--text-muted)',
                              fontWeight: isSel ? 700 : 500,
                            }}
                          >
                            {isSel ? `✓ ${skill}` : skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label
                      className="text-xs font-bold block mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--text-color)' }}
                    >
                      <ArrowUpDown size={13} className="text-emerald-500" /> Sort Results By
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'relevance', label: '🎯 Most Relevant' },
                        { id: 'xp', label: '⭐ Top XP / Level' },
                        { id: 'newest', label: '✨ Newest First' },
                        { id: 'followers', label: '👥 Most Followed' },
                      ].map((s) => {
                        const isSel = sortBy === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSortBy(s.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                            style={{
                              backgroundColor: isSel
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'var(--surface-color)',
                              borderColor: isSel ? '#10b981' : 'var(--border-color)',
                              color: isSel ? '#10b981' : 'var(--text-muted)',
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Relationship Filter */}
                  <div>
                    <label
                      className="text-xs font-bold block mb-2 flex items-center gap-1.5"
                      style={{ color: 'var(--text-color)' }}
                    >
                      <Users size={13} className="text-indigo-500" /> Developer Relationship
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', label: `All Devs (${users.filter((u) => !blockedUserIds.includes(u.id)).length})` },
                        { id: 'following', label: `Following (${followingCount})` },
                        { id: 'followers', label: `Followers (${followersCount})` },
                        ...(blockedUserIds.length > 0
                          ? [{ id: 'blocked', label: `Blocked (${blockedUserIds.length})` }]
                          : []),
                      ].map((f) => {
                        const isSel = activeFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setActiveFilter(f.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border"
                            style={{
                              backgroundColor: isSel
                                ? 'rgba(99, 102, 241, 0.15)'
                                : 'var(--surface-color)',
                              borderColor: isSel ? '#6366f1' : 'var(--border-color)',
                              color: isSel ? '#6366f1' : 'var(--text-muted)',
                            }}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Panel Footer Actions */}
                  <div
                    className="flex items-center justify-between pt-3 border-t mt-1"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-xs flex items-center gap-1.5 text-muted hover:text-white font-medium cursor-pointer transition-colors"
                    >
                      <RotateCcw size={13} /> Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> Apply & Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Active Filter Pills Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {/* Quick Content Type Tabs */}
            {typeTabs.map((t) => {
              const Icon = t.icon;
              const isSel = contentType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setContentType(t.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: isSel ? 'var(--primary-color)' : 'var(--surface-color)',
                    color: isSel ? '#fff' : 'var(--text-muted)',
                    border: '1px solid ' + (isSel ? 'var(--primary-color)' : 'var(--border-color)'),
                  }}
                >
                  <Icon size={12} />
                  <span>
                    {t.label} ({t.count})
                  </span>
                </button>
              );
            })}

            {/* Active Skill Chip */}
            {selectedSkill && (
              <span
                className="text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 bg-orange-500/15 text-orange-500 border border-orange-500/30"
              >
                <span>Skill: {selectedSkill}</span>
                <button
                  onClick={() => setSelectedSkill(null)}
                  className="hover:text-white ml-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Active Sort Chip */}
            {sortBy !== 'relevance' && (
              <span
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              >
                <span>Sort: {sortBy.toUpperCase()}</span>
                <button
                  onClick={() => setSortBy('relevance')}
                  className="hover:text-white ml-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Reset All shortcut */}
            {activeFilterCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                Reset All
              </button>
            )}

            {loading && (
              <span
                className="text-xs ml-auto flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin inline-block" />
                Searching...
              </span>
            )}
          </div>

          {/* Results Container */}
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {loading && users.length === 0 && posts.length === 0 ? (
                <Loader key="loader" />
              ) : filteredUsers.length === 0 && posts.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{
                      backgroundColor: 'var(--surface-color)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <Search size={28} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <h3
                    className="text-base font-semibold mb-1"
                    style={{ color: 'var(--text-color)' }}
                  >
                    {activeFilter === 'following'
                      ? 'Not following anyone yet'
                      : activeFilter === 'followers'
                      ? 'No followers yet'
                      : query || selectedSkill
                      ? `No results match "${query || selectedSkill}"`
                      : 'No developers or posts found'}
                  </h3>
                  <p className="text-sm max-w-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    {query || selectedSkill
                      ? 'Try adjusting your search query, clearing skill filters, or broadening your search criteria.'
                      : 'Explore developers and start networking across Connectra!'}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                      Clear All Filters
                    </button>
                  )}
                </motion.div>
              ) : (
                <>
                  {/* Developers Section */}
                  {(contentType === 'all' || contentType === 'devs') && filteredUsers.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {contentType === 'all' && posts.length > 0 && (
                        <div className="flex items-center justify-between pb-1">
                          <h2
                            className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Users size={14} className="text-orange-500" /> Developers (
                            {filteredUsers.length})
                          </h2>
                        </div>
                      )}

                      {filteredUsers.map((user, i) => {
                        const conn = connections[user.id];
                        const status = conn?.status;

                        return (
                          <motion.div
                            key={user.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.18, delay: i * 0.03 }}
                            className="glass-panel rounded-2xl p-4 flex items-center gap-4 transition-all"
                            style={{ border: '1px solid var(--border-color)' }}
                          >
                            {/* Avatar */}
                            <Link
                              to={`/profile/${encodeURIComponent(user.profileSlug || user.displayName)}`}
                              className="shrink-0"
                            >
                              <div
                                className="rounded-xl flex items-center justify-center text-base font-bold overflow-hidden border"
                                style={{
                                  width: 52,
                                  height: 52,
                                  backgroundColor: 'var(--surface-hover)',
                                  borderColor: 'var(--border-color)',
                                  color: 'var(--primary-color)',
                                }}
                              >
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt={user.displayName}
                                    className="w-full h-full object-cover"
                                  />
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
                                  onMouseEnter={(e) =>
                                    (e.target.style.color = 'var(--primary-color)')
                                  }
                                  onMouseLeave={(e) =>
                                    (e.target.style.color = 'var(--text-color)')
                                  }
                                >
                                  {user.displayName}
                                </Link>
                                {user.xp > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                                    Lv.{user.level || 1} • {user.xp} XP
                                  </span>
                                )}
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
                                <p
                                  className="text-xs mt-1 italic"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  🔒 Profile details are private. Connect to view tech stack.
                                </p>
                              ) : (
                                <>
                                  {user.bio && (
                                    <p
                                      className="text-sm truncate mt-0.5"
                                      style={{ color: 'var(--text-muted)' }}
                                    >
                                      {user.bio}
                                    </p>
                                  )}
                                  {parseTechStack(user.tech_stack).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {parseTechStack(user.tech_stack)
                                        .slice(0, 4)
                                        .map((tech, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedSkill(tech)}
                                            className="text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer hover:border-orange-500"
                                            style={{
                                              backgroundColor:
                                                selectedSkill === tech
                                                  ? 'rgba(234, 88, 12, 0.2)'
                                                  : 'var(--surface-hover)',
                                              border:
                                                '1px solid ' +
                                                (selectedSkill === tech
                                                  ? 'var(--primary-color)'
                                                  : 'var(--border-color)'),
                                              color:
                                                selectedSkill === tech
                                                  ? 'var(--primary-color)'
                                                  : 'var(--text-muted)',
                                            }}
                                            title={`Filter by ${tech}`}
                                          >
                                            {tech}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Actions & Follow */}
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
                              {/* Direct Message shortcut */}
                              <Link
                                to={`/chat?user=${user.id}`}
                                className="p-2 rounded-xl text-stone-400 hover:text-orange-500 hover:bg-orange-500/10 transition-all border border-transparent hover:border-orange-500/30 cursor-pointer flex items-center justify-center shrink-0"
                                title={`Direct message @${user.displayName}`}
                              >
                                <MessageSquare size={15} />
                              </Link>

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
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm text-white bg-primary hover:opacity-90"
                                    title="Follow developer"
                                  >
                                    <UserPlus size={13} /> Follow
                                  </button>
                                );
                              })()}

                              {/* More Menu */}
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setActiveActionMenu(
                                      activeActionMenu === user.id ? null : user.id
                                    )
                                  }
                                  aria-label="User options"
                                  className="p-2 rounded-xl transition-colors cursor-pointer"
                                  style={{ color: 'var(--text-muted)' }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                                    e.currentTarget.style.color = 'var(--text-color)';
                                  }}
                                  onMouseLeave={(e) => {
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
                                      className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer text-amber-500 hover:bg-amber-500/10"
                                    >
                                      <Flag size={13} /> Report User
                                    </button>

                                    <button
                                      onClick={() => handleBlockUser(user.id, user.displayName)}
                                      className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer text-rose-500 hover:bg-rose-500/10"
                                    >
                                      <ShieldBan size={13} /> Block User
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Matching Posts Section */}
                  {(contentType === 'all' || contentType === 'posts') && posts.length > 0 && (
                    <div className="flex flex-col gap-4 mt-2">
                      <div className="flex items-center justify-between pb-1">
                        <h2
                          className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <FileText size={14} className="text-orange-500" /> Community Posts (
                          {posts.length})
                        </h2>
                      </div>

                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          session={session}
                          onUpdate={loadAllResults}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Results count footer */}
          {!loading && (filteredUsers.length > 0 || posts.length > 0) && (
            <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
              Showing {filteredUsers.length} developer{filteredUsers.length !== 1 ? 's' : ''} and{' '}
              {posts.length} post{posts.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
              {selectedSkill ? ` in ${selectedSkill}` : ''}
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
                  <label
                    className="text-xs font-semibold block mb-1.5"
                    style={{ color: 'var(--text-color)' }}
                  >
                    Reason for report
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs outline-none border transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-color)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-color)',
                    }}
                  >
                    <option value="Spam or misleading information">
                      Spam or misleading information
                    </option>
                    <option value="Harassment or abusive behavior">
                      Harassment or abusive behavior
                    </option>
                    <option value="Inappropriate or malicious code snippet">
                      Inappropriate or malicious code snippet
                    </option>
                    <option value="Fake or impersonated profile">
                      Fake or impersonated profile
                    </option>
                    <option value="Other security/safety violation">
                      Other security/safety violation
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    className="text-xs font-semibold block mb-1.5"
                    style={{ color: 'var(--text-color)' }}
                  >
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
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
