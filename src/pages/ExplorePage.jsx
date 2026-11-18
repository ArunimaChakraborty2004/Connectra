import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Sparkles,
  ShieldCheck,
  Code2,
  Users,
  Briefcase,
  UserPlus,
  UserCheck,
  Check,
  X,
  Flame,
  Copy,
  Terminal,
  Layers,
  ChevronRight,
  Compass,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Bot,
  Globe,
  Zap,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Award,
  Plus,
  Boxes,
} from 'lucide-react';
import { toast } from '../lib/toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// Topic Channels with dynamic filtering computed from DB
const EXPLORE_TOPICS = [
  { id: 'all', label: 'All Topics', tag: 'all', icon: Sparkles, color: 'text-amber-500' },
  { id: 'security', label: '#zero-trust', tag: 'security', icon: ShieldCheck, color: 'text-emerald-500' },
  { id: 'ai', label: '#ai-agents', tag: 'ai', icon: Bot, color: 'text-purple-500' },
  { id: 'rust', label: '#rust-lang', tag: 'rust', icon: Terminal, color: 'text-orange-500' },
  { id: 'react', label: '#react19', tag: 'react', icon: Code2, color: 'text-blue-500' },
  { id: 'devops', label: '#docker', tag: 'devops', icon: Layers, color: 'text-cyan-500' },
  { id: 'distributed', label: '#distributed-sys', tag: 'distributed', icon: Database, color: 'text-indigo-500' },
  { id: 'golang', label: '#golang', tag: 'golang', icon: Cpu, color: 'text-teal-500' },
];

// SaaS Category Filter Tabs
const CATEGORY_TABS = [
  { id: 'all', label: '🔥 For You', icon: Flame },
  { id: 'code', label: '💻 Code Snippets', icon: Code2 },
  { id: 'projects', label: '🚀 Projects & Demos', icon: Briefcase },
  { id: 'security', label: '🛡️ Security & Audits', icon: ShieldCheck },
  { id: 'builders', label: '👥 Top Builders', icon: Users },
  { id: 'communities', label: '🌐 Communities', icon: Globe },
];

// Quick Search Tag Suggestions
const QUICK_SUGGESTIONS = [
  'Zero-Trust',
  'Rust',
  'React 19',
  'Llama 3.3',
  'Go Channels',
  'PostgreSQL',
  'Docker',
  'eBPF',
];

// SaaS Vector Icon Resolver for Communities
function getCommunityIcon(category = '', slug = '', size = 18) {
  const cat = (category || '').toLowerCase();
  const s = (slug || '').toLowerCase();
  if (cat.includes('ai') || s.includes('ai') || s.includes('agent')) {
    return <Bot size={size} className="text-purple-600 dark:text-purple-400" />;
  }
  if (cat.includes('sec') || s.includes('sec') || s.includes('zero')) {
    return <ShieldCheck size={size} className="text-emerald-600 dark:text-emerald-400" />;
  }
  if (cat.includes('sys') || s.includes('rust') || s.includes('kernel')) {
    return <Cpu size={size} className="text-orange-600 dark:text-orange-400" />;
  }
  if (cat.includes('web') || s.includes('web') || s.includes('react')) {
    return <Globe size={size} className="text-blue-600 dark:text-blue-400" />;
  }
  if (cat.includes('cloud') || s.includes('devops') || s.includes('docker')) {
    return <Boxes size={size} className="text-cyan-600 dark:text-cyan-400" />;
  }
  if (cat.includes('data') || s.includes('db') || s.includes('sql')) {
    return <Database size={size} className="text-amber-600 dark:text-amber-400" />;
  }
  return <Terminal size={size} className="text-[#ea580c]" />;
}

// Language badge styling helper
const getLangColor = (lang = '') => {
  const l = (lang || '').toLowerCase();
  if (l.includes('rust')) return { text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/25' };
  if (l.includes('python')) return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/25' };
  if (l.includes('go')) return { text: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/25' };
  if (l.includes('type') || l.includes('ts')) return { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/25' };
  if (l.includes('java') || l.includes('js')) return { text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' };
  if (l.includes('sql')) return { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/25' };
  return { text: 'text-stone-400', bg: 'bg-stone-500/10', border: 'border-stone-500/25' };
};

// Relative Time Formatter
function timeAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ExplorePage({ session }) {
  const navigate = useNavigate();
  const currentUserId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  // Search & Navigation States
  const [query, setQuery] = useState(initialQuery);
  const [activeTopic, setActiveTopic] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('trending'); // 'trending', 'latest', 'discussed'
  const [viewMode, setViewMode] = useState('masonry'); // 'masonry', 'list'

  // 100% Real Database State
  const [dbPosts, setDbPosts] = useState([]);
  const [dbProfiles, setDbProfiles] = useState([]);
  const [dbCommunities, setDbCommunities] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [userStats, setUserStats] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  // User Interactive Maps
  const [followingMap, setFollowingMap] = useState({});
  const [likedPostsMap, setLikedPostsMap] = useState({});
  const [savedPostsMap, setSavedPostsMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('connectra_saved_posts') || '{}');
    } catch {
      return {};
    }
  });
  const [likesCountMap, setLikesCountMap] = useState({});

  // Lightbox Modal state
  const [selectedPost, setSelectedPost] = useState(null);
  const [modalComments, setModalComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Keyboard shortcut: Ctrl+K or / to focus search
  const searchInputRef = useRef(null);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && selectedPost) {
        setSelectedPost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPost]);

  // 1. Fetch Current User Profile & Stats from Database for Sidebar
  useEffect(() => {
    if (!currentUserId) return;

    const loadUser = async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio, xp, level')
          .eq('id', currentUserId)
          .single();

        if (prof) {
          setCurrentUserProfile(prof);
        } else {
          const fallback = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Developer';
          setCurrentUserProfile({ id: currentUserId, username: fallback, xp: 0, level: 1 });
        }

        const [
          { count: fCount },
          { count: foCount },
        ] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', currentUserId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId),
        ]);

        setUserStats({
          followers: fCount || 0,
          following: foCount || 0,
        });
      } catch (err) {
        console.warn('Error loading user profile in Explore:', err);
      }
    };

    loadUser();

    window.addEventListener('refreshStats', loadUser);
    return () => window.removeEventListener('refreshStats', loadUser);
  }, [currentUserId, session?.user]);

  // 2. Fetch 100% Real Database Data (Posts, Profiles, Communities, Likes, Comments)
  const fetchExploreData = async () => {
    setLoading(true);
    try {
      // A. Fetch real posts from Supabase database
      const { data: postsData, error: postsErr } = await supabase
        .from('posts')
        .select(`
          id, user_id, content, image_url, code_snippet, code_language, created_at,
          community_id, community_slug, poll_data
        `)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!postsErr && postsData && postsData.length > 0) {
        const postIds = postsData.map(p => p.id);
        const authorIds = [...new Set(postsData.map(p => p.user_id).filter(Boolean))];

        // Fetch likes, comments count, and author profiles from DB
        const [
          { data: likesData },
          { data: commentsCountData },
          { data: authorsData }
        ] = await Promise.all([
          supabase.from('likes').select('id, post_id, user_id').in('post_id', postIds),
          supabase.from('comments').select('id, post_id').in('post_id', postIds),
          authorIds.length > 0
            ? supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', authorIds)
            : Promise.resolve({ data: [] })
        ]);

        const authorsMap = {};
        (authorsData || []).forEach(a => {
          authorsMap[a.id] = a;
        });

        const likesCount = {};
        const myLikes = {};
        (likesData || []).forEach(l => {
          likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1;
          if (l.user_id === currentUserId) {
            myLikes[l.post_id] = true;
          }
        });
        setLikedPostsMap(myLikes);
        setLikesCountMap(likesCount);

        const commentsCount = {};
        (commentsCountData || []).forEach(c => {
          commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1;
        });

        // Normalize DB posts to uniform format
        const normalized = postsData.map((p, idx) => {
          const isCode = Boolean(p.code_snippet);
          const hasImage = Boolean(p.image_url);
          const author = authorsMap[p.user_id] || {
            id: p.user_id,
            username: 'developer',
            full_name: 'Developer',
            avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          };

          const extractedTags = [];
          if (p.code_language) extractedTags.push(p.code_language.toLowerCase());
          if (p.community_slug) extractedTags.push(p.community_slug.toLowerCase());
          const matches = (p.content || '').match(/#[a-z0-9_-]+/gi);
          if (matches) {
            matches.slice(0, 3).forEach(m => extractedTags.push(m.replace('#', '').toLowerCase()));
          }

          return {
            id: p.id,
            user_id: p.user_id,
            type: isCode ? 'code' : hasImage ? 'project' : 'general',
            size: idx % 5 === 0 ? 'hero' : idx % 2 === 0 ? 'tall' : 'square',
            title: p.content ? p.content.slice(0, 60).split('\n')[0] : 'Developer Discussion',
            author: {
              id: author.id,
              username: author.username || 'developer',
              full_name: author.full_name || author.username || 'Developer',
              avatar_url: author.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              badge: 'Community Member',
            },
            likes_count: likesCount[p.id] || 0,
            comments_count: commentsCount[p.id] || 0,
            tags: extractedTags.length > 0 ? extractedTags : ['tech', 'dev'],
            language: p.code_language || (isCode ? 'Code' : null),
            code_snippet: p.code_snippet || null,
            image_url: p.image_url || null,
            caption: p.content || '',
            created_at: p.created_at,
            community_slug: p.community_slug,
            community_id: p.community_id,
          };
        });

        setDbPosts(normalized);
      } else {
        setDbPosts([]);
      }

      // B. Fetch real builders from database profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, tech_stack, xp, level')
        .order('xp', { ascending: false })
        .limit(30);

      setDbProfiles(profilesData || []);

      // C. Fetch real communities from database
      const { data: commsData } = await supabase
        .from('communities')
        .select('*')
        .order('member_count', { ascending: false })
        .limit(30);

      setDbCommunities(commsData || []);

      // D. Fetch user follows if authenticated
      if (currentUserId) {
        const { data: userFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId);

        if (userFollows) {
          const fMap = {};
          userFollows.forEach(f => { fMap[f.following_id] = true; });
          setFollowingMap(fMap);
        }
      }
    } catch (err) {
      console.warn('Error fetching explore data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExploreData();
  }, [currentUserId]);

  // Dynamic post counts per topic channel computed directly from DB posts
  const topicCounts = useMemo(() => {
    const counts = {};
    EXPLORE_TOPICS.forEach(topic => {
      if (topic.tag === 'all') {
        counts[topic.tag] = dbPosts.length;
      } else {
        const t = topic.tag.toLowerCase();
        counts[topic.tag] = dbPosts.filter(p => {
          const matchTag = (p.tags || []).some(tg => tg.includes(t));
          const matchTitle = (p.title || '').toLowerCase().includes(t);
          const matchCaption = (p.caption || '').toLowerCase().includes(t);
          const matchLang = (p.language || '').toLowerCase().includes(t);
          return matchTag || matchTitle || matchCaption || matchLang;
        }).length;
      }
    });
    return counts;
  }, [dbPosts]);

  // Synchronize query from URL
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Search input change handler
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Like Toggle in real database
  const handleToggleLike = async (post, e) => {
    e?.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to like posts.');
      return;
    }
    const postId = post.id;
    const isCurrentlyLiked = likedPostsMap[postId];

    // Optimistic UI update
    setLikedPostsMap(prev => ({ ...prev, [postId]: !isCurrentlyLiked }));
    setLikesCountMap(prev => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? post.likes_count) + (isCurrentlyLiked ? -1 : 1)),
    }));

    toast.success(isCurrentlyLiked ? 'Removed from liked posts' : 'Added to your liked posts ❤️');

    try {
      if (isCurrentlyLiked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
      } else {
        await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
      }
    } catch (err) {
      console.warn('Like toggle failed:', err);
    }
  };

  // Bookmark Toggle with LocalStorage persistence
  const handleToggleSave = (postId, e) => {
    e?.stopPropagation();
    setSavedPostsMap(prev => {
      const isSaved = !prev[postId];
      const updated = { ...prev, [postId]: isSaved };
      localStorage.setItem('connectra_saved_posts', JSON.stringify(updated));
      toast.success(isSaved ? 'Saved to your personal collection 🔖' : 'Removed from saved collection');
      return updated;
    });
  };

  // Follow / Unfollow Toggle in real database
  const handleToggleFollow = async (targetUserId, targetUsername, e) => {
    e?.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to follow builders.');
      return;
    }
    if (targetUserId === currentUserId) {
      toast.info('You cannot follow yourself!');
      return;
    }

    const isFollowing = followingMap[targetUserId] || followingMap[targetUsername];
    const newStatus = !isFollowing;

    // 1. Optimistically update follow button state
    setFollowingMap(prev => ({
      ...prev,
      [targetUserId]: newStatus,
      [targetUsername]: newStatus,
    }));

    // 2. Optimistically update KPI Following count instantly
    setUserStats(prev => ({
      ...prev,
      following: Math.max(0, (prev.following || 0) + (newStatus ? 1 : -1)),
    }));

    // 3. Dispatch global event with optimistic delta
    window.dispatchEvent(new CustomEvent('refreshStats', {
      detail: { deltaFollowing: newStatus ? 1 : -1 }
    }));

    toast.success(newStatus ? `Following @${targetUsername} 🤝` : `Unfollowed @${targetUsername}`);

    try {
      if (newStatus) {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId });
      } else {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', targetUserId);
      }
      window.dispatchEvent(new Event('refreshStats'));
    } catch (err) {
      console.warn('Follow toggle error:', err);
    }
  };

  // Direct Message Author
  const handleMessageAuthor = (username, e) => {
    e?.stopPropagation();
    if (!username) return;
    document.dispatchEvent(new CustomEvent('startChat', {
      detail: { username }
    }));
    navigate(`/chat?username=${encodeURIComponent(username)}`);
  };

  // Copy Code to Clipboard
  const handleCopyCode = (code, id, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success('Code snippet copied to clipboard! 📋');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Open Lightbox Modal and load 100% REAL comments from database
  const handleOpenPostModal = async (post) => {
    setSelectedPost(post);
    setModalComments([]);
    setNewComment('');

    if (post.id) {
      try {
        const { data: commentsData } = await supabase
          .from('comments')
          .select('id, content, created_at, user_id')
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        if (commentsData && commentsData.length > 0) {
          const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];
          let cProfilesMap = {};
          if (userIds.length > 0) {
            const { data: cProfs } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .in('id', userIds);
            (cProfs || []).forEach(cp => {
              cProfilesMap[cp.id] = cp;
            });
          }

          const normalizedComments = commentsData.map(c => ({
            ...c,
            profiles: cProfilesMap[c.user_id] || { username: 'developer', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }
          }));

          setModalComments(normalizedComments);
        } else {
          setModalComments([]);
        }
      } catch (err) {
        console.warn('Failed to load post comments:', err);
      }
    }
  };

  // Submit Comment in Modal to Database
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;

    if (!currentUserId) {
      toast.error('Please log in to leave comments.');
      return;
    }

    const commentText = newComment.trim();
    const tempComment = {
      id: 'temp-' + Date.now(),
      content: commentText,
      created_at: new Date().toISOString(),
      profiles: {
        username: currentUserProfile?.username || 'You',
        avatar_url: currentUserProfile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      },
    };

    setModalComments(prev => [...prev, tempComment]);
    setNewComment('');
    toast.success('Comment posted! 🚀');

    setSubmittingComment(true);
    try {
      await supabase.from('comments').insert({
        post_id: selectedPost.id,
        user_id: currentUserId,
        content: commentText,
      });

      // Increment count on post in state
      setDbPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    } catch (err) {
      console.warn('Comment submission failed:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Filter & Sort Posts from Database
  const filteredPosts = useMemo(() => {
    let list = [...dbPosts];

    // Topic Filter
    if (activeTopic !== 'all') {
      const t = activeTopic.toLowerCase();
      list = list.filter(p => {
        const matchesTag = (p.tags || []).some(tag => tag.toLowerCase().includes(t));
        const matchesTitle = (p.title || '').toLowerCase().includes(t);
        const matchesLang = (p.language || '').toLowerCase().includes(t);
        const matchesComm = (p.community_slug || '').toLowerCase().includes(t);
        const matchesCaption = (p.caption || '').toLowerCase().includes(t);
        return matchesTag || matchesTitle || matchesLang || matchesComm || matchesCaption;
      });
    }

    // Category Filter
    if (activeCategory !== 'all') {
      if (activeCategory === 'code') {
        list = list.filter(p => p.type === 'code' || Boolean(p.code_snippet));
      } else if (activeCategory === 'projects') {
        list = list.filter(p => p.type === 'project' || Boolean(p.image_url));
      } else if (activeCategory === 'security') {
        list = list.filter(p =>
          p.type === 'security' ||
          (p.tags || []).some(t => ['security', 'zero-trust', 'cwe', 'audit', 'sqlx', 'crypto', 'ebpf'].includes(t.toLowerCase())) ||
          (p.caption || '').toLowerCase().includes('security')
        );
      }
    }

    // Search Query
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const captionMatch = (p.caption || '').toLowerCase().includes(q);
        const tagMatch = (p.tags || []).some(t => t.toLowerCase().includes(q));
        const authorMatch =
          (p.author?.username || '').toLowerCase().includes(q) ||
          (p.author?.full_name || '').toLowerCase().includes(q);
        const langMatch = (p.language || '').toLowerCase().includes(q);
        return titleMatch || captionMatch || tagMatch || authorMatch || langMatch;
      });
    }

    // Sorting
    if (sortBy === 'trending') {
      list.sort((a, b) => ((b.likes_count || 0) + (b.comments_count || 0)) - ((a.likes_count || 0) + (a.comments_count || 0)));
    } else if (sortBy === 'latest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'discussed') {
      list.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
    }

    return list;
  }, [dbPosts, activeTopic, activeCategory, query, sortBy]);

  // Filter Builders for Builders Tab
  const filteredBuilders = useMemo(() => {
    let list = [...dbProfiles];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(b => {
        const uname = (b.username || '').toLowerCase();
        const fname = (b.full_name || '').toLowerCase();
        const bio = (b.bio || '').toLowerCase();
        const tech = (Array.isArray(b.tech_stack) ? b.tech_stack.join(' ') : (b.tech_stack || '')).toLowerCase();
        return uname.includes(q) || fname.includes(q) || bio.includes(q) || tech.includes(q);
      });
    }
    return list;
  }, [dbProfiles, query]);

  // Filter Communities for Communities Tab
  const filteredCommunities = useMemo(() => {
    let list = [...dbCommunities];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        const cat = (c.category || '').toLowerCase();
        const tags = (c.tags || []).join(' ').toLowerCase();
        return name.includes(q) || desc.includes(q) || cat.includes(q) || tags.includes(q);
      });
    }
    return list;
  }, [dbCommunities, query]);

  // Top Spotlight Builders from database profiles
  const spotlightBuilders = useMemo(() => {
    return [...dbProfiles].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 6);
  }, [dbProfiles]);

  return (
    <div className="min-h-screen bg-[#faf6f0] dark:bg-[#150f0c] text-[#1c130d] dark:text-[#faf6f0] transition-colors duration-200 pb-20 select-none">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-6 flex flex-col lg:flex-row gap-6 relative z-10">

        {/* 1. LEFT STICKY SIDEBAR */}
        <div className="hidden lg:block w-[260px] xl:w-[280px] shrink-0 sticky top-20 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto custom-scrollbar">
          <Sidebar
            profile={currentUserProfile || { id: currentUserId, username: session?.user?.email?.split('@')[0] || 'Developer' }}
            stats={userStats}
          />
        </div>

        {/* 2. CENTER EXPLORE FEED */}
        <div className="flex-1 w-full min-w-0 space-y-6">

          {/* =========================================================================
              HERO BANNER & SEARCH BAR
              ========================================================================= */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#fffcf7] via-white to-[#fff4e6] dark:from-[#1f1813] dark:via-[#1a1410] dark:to-[#2b1f17] border border-[#f1e4d3] dark:border-[#3d2e24] shadow-md shadow-orange-500/5"
          >
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                    <Compass size={14} className="animate-spin-slow" />
                    <span>Explore Connectra</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1c130d] dark:text-white">
                    Developer Knowledge Hub
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6b5546] dark:text-[#c4aba0]">
                    Discover verified code snippets, architecture deep-dives, top builders, and specialized engineering guilds.
                  </p>
                </div>

                {/* Ecosystem Database Live Counters */}
                <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs font-bold">
                    <Sparkles size={13} className="text-[#ea580c]" />
                    <span>{dbPosts.length} Posts</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs font-bold">
                    <Users size={13} className="text-emerald-600" />
                    <span>{dbProfiles.length} Builders</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs font-bold">
                    <Globe size={13} className="text-blue-600" />
                    <span>{dbCommunities.length} Guilds</span>
                  </span>
                </div>
              </div>

              {/* Integrated Search Input with Ctrl+K Indicator */}
              <div className="relative w-full">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d7565] dark:text-[#a89080] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search code snippets, #zero-trust, rust, developers, or tags... (Press / to focus)"
                  className="w-full pl-11 pr-24 py-3 rounded-2xl bg-white/95 dark:bg-[#1a1410]/95 border border-[#f1e4d3] dark:border-[#382b22] focus:border-[#ea580c] focus:ring-2 focus:ring-orange-500/20 text-xs sm:text-sm text-[#1c130d] dark:text-white placeholder-[#8d7565] outline-none transition-all shadow-inner"
                />

                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {query ? (
                    <button
                      type="button"
                      onClick={() => { setQuery(''); setSearchParams({}); }}
                      className="text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white p-1 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#251b15] text-[10px] font-mono text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22]">
                      Ctrl+K
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Search Tag Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 custom-scrollbar">
                <span className="text-[11px] font-bold text-[#8d7565] shrink-0 mr-1">Trending:</span>
                {QUICK_SUGGESTIONS.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setQuery(tag); setSearchParams({ q: tag }); }}
                    className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-[#251b15] hover:bg-orange-50 dark:hover:bg-orange-950/40 text-[11px] font-mono font-medium text-[#6b5546] dark:text-[#c4aba0] hover:text-orange-600 dark:hover:text-orange-400 border border-[#f1e4d3] dark:border-[#382b22] transition-colors shrink-0 cursor-pointer"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* =========================================================================
              TOOLBAR: CATEGORY TABS + SORT & VIEW TOGGLES
              ========================================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {CATEGORY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeCategory === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#1c130d] text-white dark:bg-white dark:text-black shadow-sm'
                        : 'bg-white/80 dark:bg-[#1a1410]/80 text-[#6b5546] dark:text-[#a89080] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#33251c]'
                    }`}
                  >
                    <Icon size={13} className={isSelected ? (tab.id === 'all' ? 'text-orange-400' : '') : ''} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sort & View Mode Controls */}
            {activeCategory !== 'builders' && activeCategory !== 'communities' && (
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <div className="flex items-center gap-1 bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] rounded-xl px-2.5 py-1 text-xs">
                  <SlidersHorizontal size={12} className="text-[#8d7565]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#1c130d] dark:text-white outline-none cursor-pointer"
                  >
                    <option value="trending" className="dark:bg-[#1a1410]">Trending</option>
                    <option value="latest" className="dark:bg-[#1a1410]">Latest</option>
                    <option value="discussed" className="dark:bg-[#1a1410]">Most Discussed</option>
                  </select>
                </div>

                <div className="flex items-center bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('masonry')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'masonry' ? 'bg-[#ea580c] text-white' : 'text-[#8d7565] hover:text-[#1c130d]'}`}
                    title="Bento Masonry View"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-[#ea580c] text-white' : 'text-[#8d7565] hover:text-[#1c130d]'}`}
                    title="Reader List View"
                  >
                    <LayoutList size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              WHEN IN "FOR YOU" (ALL) VIEW: SHOW MULTI-SECTION DISCOVERY ECOSYSTEM
              ========================================================================= */}
          {activeCategory === 'all' && !query && (
            <div className="space-y-6">

              {/* ---------------------------------------------------------------------
                  SECTION 1: TRENDING COMMUNITIES HUBS (100% REAL DATABASE COMMUNITIES)
                  --------------------------------------------------------------------- */}
              {dbCommunities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <Globe size={14} />
                      </span>
                      <h2 className="text-sm sm:text-base font-extrabold text-[#1c130d] dark:text-white">
                        Featured Technical Guilds ({dbCommunities.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('communities')}
                      className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View all guilds</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {dbCommunities.slice(0, 4).map((comm) => (
                      <div
                        key={comm.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                              {getCommunityIcon(comm.category, comm.slug, 16)}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#faf6f0] dark:bg-[#251b15] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]">
                              {comm.category || 'Guild'}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-extrabold text-xs text-[#1c130d] dark:text-white line-clamp-1">
                              {comm.name}
                            </h3>
                            <p className="text-[11px] text-[#6b5546] dark:text-[#c4aba0] line-clamp-2 mt-0.5 leading-relaxed">
                              {comm.description || 'Specialized developer community.'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#f1e4d3] dark:border-[#33251c] flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[#8d7565] dark:text-[#a89080] flex items-center gap-1">
                            <Users size={11} />
                            <span>{comm.member_count || 0} members</span>
                          </span>

                          <Link
                            to={`/communities?community=${comm.id}`}
                            className="px-2.5 py-1 rounded-lg bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <span>Explore</span>
                            <ArrowRight size={11} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------------------------------------------------------------
                  SECTION 2: SPOTLIGHT BUILDERS TO CONNECT (100% REAL DATABASE PROFILES)
                  --------------------------------------------------------------------- */}
              {spotlightBuilders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Users size={14} />
                      </span>
                      <h2 className="text-sm sm:text-base font-extrabold text-[#1c130d] dark:text-white">
                        Active Engineers & Builders ({dbProfiles.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('builders')}
                      className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Browse directory</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {spotlightBuilders.slice(0, 3).map((builder) => {
                      const isFollowing = followingMap[builder.id] || followingMap[builder.username];
                      const stack = Array.isArray(builder.tech_stack)
                        ? builder.tech_stack
                        : (builder.tech_stack ? builder.tech_stack.split(/[,|/]+/).map(s => s.trim()) : ['Developer']);

                      return (
                        <div
                          key={builder.id}
                          className="p-4 rounded-2xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={builder.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                              alt={builder.username}
                              className="w-10 h-10 rounded-xl object-cover border border-[#f1e4d3] dark:border-[#33251c]"
                            />
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/profile/${builder.username}`}
                                className="font-extrabold text-xs text-[#1c130d] dark:text-white hover:text-orange-500 transition-colors flex items-center gap-1 truncate"
                              >
                                <span>{builder.full_name || builder.username}</span>
                                <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                              </Link>
                              <p className="text-[11px] text-[#8d7565] dark:text-[#a89080] truncate">@{builder.username}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                  Lvl {builder.level || 1}
                                </span>
                                <span className="text-[9px] text-[#8d7565] dark:text-[#a89080]">
                                  {builder.xp || 0} XP
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {stack.slice(0, 3).map((tech, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#faf6f0] dark:bg-[#251b15] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5 pt-2 border-t border-[#f1e4d3] dark:border-[#33251c]">
                            <button
                              type="button"
                              onClick={(e) => handleToggleFollow(builder.id, builder.username, e)}
                              className={`flex-1 py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                isFollowing
                                  ? 'bg-[#faf6f0] dark:bg-[#251b15] text-[#6b5546] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]'
                                  : 'bg-[#ea580c] hover:bg-orange-600 text-white shadow-xs'
                              }`}
                            >
                              {isFollowing ? <UserCheck size={11} /> : <UserPlus size={11} />}
                              <span>{isFollowing ? 'Following' : 'Connect'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleMessageAuthor(builder.username, e)}
                              className="p-1.5 rounded-lg bg-[#faf6f0] dark:bg-[#251b15] text-[#6b5546] dark:text-[#a89080] hover:text-[#ea580c] border border-[#f1e4d3] dark:border-[#382b22] cursor-pointer"
                              title="Send Message"
                            >
                              <MessageSquare size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* =========================================================================
              HORIZONTAL TOPIC PILLS (Channels with live counts from DB)
              ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8d7565] dark:text-[#a89080] uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={13} className="text-orange-500" />
                <span>Technical Channels ({dbPosts.length} posts in DB)</span>
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 custom-scrollbar">
              {EXPLORE_TOPICS.map((topic) => {
                const Icon = topic.icon;
                const isSelected = activeTopic === topic.tag;
                const count = topicCounts[topic.tag] || 0;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setActiveTopic(topic.tag)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#ea580c] text-white shadow-md shadow-orange-500/20 scale-102'
                        : 'bg-white dark:bg-[#1c1511] text-[#6b5546] dark:text-[#c4aba0] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/30'
                    }`}
                  >
                    <Icon size={14} className={isSelected ? 'text-white' : topic.color} />
                    <span>{topic.label}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 dark:bg-stone-800 text-[#8d7565]'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              MAIN CONTENT VIEWPORT (100% PURE DATABASE ENTITIES)
              ========================================================================= */}
          {loading ? (
            /* Skeleton Loading State */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-60 rounded-3xl bg-white/60 dark:bg-[#1a1410]/60 border border-[#f1e4d3] dark:border-[#33251c] animate-pulse p-5 flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-300 dark:bg-stone-800" />
                    <div className="h-3 w-24 bg-stone-200 dark:bg-stone-800 rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-stone-200 dark:bg-stone-800 rounded" />
                    <div className="h-3 w-1/2 bg-stone-200 dark:bg-stone-800 rounded" />
                  </div>
                  <div className="h-3 w-20 bg-stone-200 dark:bg-stone-800 rounded" />
                </div>
              ))}
            </div>
          ) : activeCategory === 'builders' ? (
            /* BUILDERS DIRECTORY VIEW (100% REAL DATABASE PROFILES) */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8d7565] dark:text-[#a89080]">
                  Showing {filteredBuilders.length} verified builders in database
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredBuilders.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c]">
                    <Users size={32} className="mx-auto mb-2 text-orange-500 opacity-60" />
                    <p className="text-sm font-bold">No builders found matching "{query}"</p>
                  </div>
                ) : (
                  filteredBuilders.map((builder) => {
                    const isFollowing = followingMap[builder.id] || followingMap[builder.username];
                    const stack = Array.isArray(builder.tech_stack)
                      ? builder.tech_stack
                      : (builder.tech_stack ? builder.tech_stack.split(/[,|/]+/).map(s => s.trim()) : ['Developer']);

                    return (
                      <div
                        key={builder.id}
                        className="p-5 rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/40 hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={builder.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={builder.username}
                            className="w-12 h-12 rounded-2xl object-cover border border-[#f1e4d3] dark:border-[#33251c]"
                          />
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/profile/${builder.username}`}
                              className="font-extrabold text-sm text-[#1c130d] dark:text-white hover:text-orange-500 transition-colors flex items-center gap-1 truncate"
                            >
                              <span>{builder.full_name || builder.username}</span>
                              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                            </Link>
                            <p className="text-xs text-[#8d7565] dark:text-[#a89080] truncate">@{builder.username}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                Lvl {builder.level || 1}
                              </span>
                              <span className="text-[10px] text-[#8d7565] dark:text-[#a89080]">
                                {builder.xp || 0} XP
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] line-clamp-2 leading-relaxed">
                          {builder.bio || 'Building open-source tools and contributing to Connectra technical communities.'}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {stack.slice(0, 4).map((tech, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#251b15] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-[#f1e4d3] dark:border-[#33251c]">
                          <button
                            type="button"
                            onClick={(e) => handleToggleFollow(builder.id, builder.username, e)}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              isFollowing
                                ? 'bg-[#faf6f0] dark:bg-[#251b15] text-[#6b5546] dark:text-[#a89080] hover:text-red-500 border border-[#f1e4d3] dark:border-[#382b22]'
                                : 'bg-[#ea580c] hover:bg-orange-600 text-white shadow-xs'
                            }`}
                          >
                            {isFollowing ? <UserCheck size={13} /> : <UserPlus size={13} />}
                            <span>{isFollowing ? 'Following' : 'Connect'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleMessageAuthor(builder.username, e)}
                            className="p-2 rounded-xl bg-[#faf6f0] dark:bg-[#251b15] text-[#6b5546] dark:text-[#a89080] hover:text-[#ea580c] border border-[#f1e4d3] dark:border-[#382b22] cursor-pointer"
                            title="Send Message"
                          >
                            <MessageSquare size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeCategory === 'communities' ? (
            /* COMMUNITIES DIRECTORY VIEW (100% REAL DATABASE COMMUNITIES) */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8d7565] dark:text-[#a89080]">
                  Showing {filteredCommunities.length} engineering guilds in database
                </span>
                <Link
                  to="/communities"
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Community Workspace</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredCommunities.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c]">
                    <Globe size={32} className="mx-auto mb-2 text-orange-500 opacity-60" />
                    <p className="text-sm font-bold">No communities found in the database matching "{query}"</p>
                    <Link
                      to="/communities"
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ea580c] text-white font-bold text-xs"
                    >
                      <Plus size={14} />
                      <span>Create New Community</span>
                    </Link>
                  </div>
                ) : (
                  filteredCommunities.map((comm) => (
                    <div
                      key={comm.id}
                      className="p-5 rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/40 hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center font-bold text-lg border border-orange-500/20">
                            {getCommunityIcon(comm.category, comm.slug, 20)}
                          </span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#faf6f0] dark:bg-[#251b15] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]">
                            {comm.category || 'Guild'}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-extrabold text-sm text-[#1c130d] dark:text-white leading-snug">
                            {comm.name}
                          </h3>
                          <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] line-clamp-2 mt-1 leading-relaxed">
                            {comm.description || 'Specialized technical hub for collaborative development.'}
                          </p>
                        </div>

                        {comm.tags && (
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(comm.tags) ? comm.tags : String(comm.tags).split(',')).slice(0, 3).map((t, idx) => (
                              <span key={idx} className="text-[10px] text-orange-600 dark:text-orange-400 font-mono">
                                #{String(t).trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#f1e4d3] dark:border-[#33251c] flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#8d7565] dark:text-[#a89080] flex items-center gap-1">
                          <Users size={12} />
                          <span>{comm.member_count || 0} members</span>
                        </span>

                        <Link
                          to={`/communities?community=${comm.id}`}
                          className="px-3 py-1.5 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <span>Open Guild</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* TECHNICAL DISCUSSIONS & CODE SHOWCASES VIEW (100% REAL DATABASE POSTS) */
            filteredPosts.length === 0 ? (
              <div className="p-16 text-center rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] text-[#8d7565] space-y-3">
                <Compass size={40} className="mx-auto text-orange-500 opacity-40 animate-pulse" />
                <h3 className="font-extrabold text-base text-[#1c130d] dark:text-white">
                  {dbPosts.length === 0 ? 'No posts in database yet' : 'No posts match your filters'}
                </h3>
                <p className="text-xs max-w-sm mx-auto text-[#6b5546] dark:text-[#c4aba0]">
                  {dbPosts.length === 0
                    ? 'Your database is connected and ready. Share the first code snippet, project demo, or architecture pattern!'
                    : 'Try clearing your search query or switching topic channels to find more discussions.'}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {query || activeTopic !== 'all' || activeCategory !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => { setActiveTopic('all'); setActiveCategory('all'); setQuery(''); }}
                      className="px-4 py-2 rounded-xl bg-[#ea580c] text-white font-bold text-xs cursor-pointer hover:bg-orange-600 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  ) : (
                    <Link
                      to="/"
                      className="px-4 py-2 rounded-xl bg-[#ea580c] text-white font-bold text-xs inline-flex items-center gap-1.5 hover:bg-orange-600 transition-colors"
                    >
                      <Plus size={14} />
                      <span>Create First Post</span>
                    </Link>
                  )}
                </div>
              </div>
            ) : viewMode === 'list' ? (
              /* READER LIST VIEW (100% REAL DB POSTS) */
              <div className="space-y-4">
                {filteredPosts.map((post) => {
                  const isLiked = likedPostsMap[post.id];
                  const isSaved = savedPostsMap[post.id];
                  const currentLikes = likesCountMap[post.id] ?? post.likes_count;
                  const langColor = getLangColor(post.language);

                  return (
                    <div
                      key={post.id}
                      onClick={() => handleOpenPostModal(post)}
                      className="p-5 rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/40 hover:shadow-md transition-all cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={post.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                            alt=""
                            className="w-9 h-9 rounded-xl object-cover border border-orange-500/30"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-[#1c130d] dark:text-white">
                                {post.author?.full_name || post.author?.username}
                              </span>
                              <span className="text-xs text-[#8d7565] dark:text-[#a89080]">
                                @{post.author?.username}
                              </span>
                              {post.community_slug && (
                                <span className="text-[10px] font-mono text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                                  in #{post.community_slug}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#8d7565]">{timeAgo(post.created_at)}</span>
                          </div>
                        </div>

                        {post.language && (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${langColor.bg} ${langColor.text} ${langColor.border}`}>
                            {post.language}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm sm:text-base text-[#1c130d] dark:text-white">
                        {post.title}
                      </h3>

                      <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] line-clamp-2 leading-relaxed">
                        {post.caption}
                      </p>

                      {post.code_snippet && (
                        <div className="rounded-2xl bg-[#0f0e0d] p-3 font-mono text-xs text-stone-200 border border-white/10 relative group/code">
                          <pre className="line-clamp-3 text-[11px] overflow-hidden leading-relaxed">
                            {post.code_snippet}
                          </pre>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(post.code_snippet, post.id, e)}
                            className="absolute top-2 right-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] text-white flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCodeId === post.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{copiedCodeId === post.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-[#f1e4d3] dark:border-[#33251c] text-xs">
                        <div className="flex items-center gap-4 text-[#8d7565]">
                          <span className="flex items-center gap-1 hover:text-rose-500">
                            <Heart size={14} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                            <span>{currentLikes}</span>
                          </span>
                          <span className="flex items-center gap-1 hover:text-orange-500">
                            <MessageSquare size={14} />
                            <span>{post.comments_count}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleToggleSave(post.id, e)}
                            className="p-1 hover:text-amber-500 text-[#8d7565] cursor-pointer"
                          >
                            <Bookmark size={15} className={isSaved ? 'fill-amber-500 text-amber-500' : ''} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MASONRY / BENTO GRID VIEW (100% REAL DB POSTS) */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 auto-rows-[250px]">
                {filteredPosts.map((post, idx) => {
                  const isHero = post.size === 'hero';
                  const isTall = post.size === 'tall';
                  const isLiked = likedPostsMap[post.id];
                  const currentLikes = likesCountMap[post.id] ?? post.likes_count;
                  const langColor = getLangColor(post.language);

                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: idx * 0.03 }}
                      onClick={() => handleOpenPostModal(post)}
                      className={`group relative rounded-3xl overflow-hidden cursor-pointer bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#33251c] hover:border-orange-500/50 hover:shadow-xl transition-all ${
                        isHero ? 'sm:col-span-2 sm:row-span-2' : isTall ? 'sm:row-span-2' : 'col-span-1 row-span-1'
                      }`}
                    >
                      {/* CARD CONTENT LAYER */}
                      {post.type === 'code' || post.code_snippet ? (
                        /* Mini IDE Code Card */
                        <div className="w-full h-full bg-[#121110] p-4 flex flex-col justify-between font-mono text-xs overflow-hidden text-stone-200">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px] text-stone-400">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                              <span className={`ml-1 font-bold ${langColor.text}`}>{post.language}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold text-[9px] border border-emerald-500/20">
                              Verified
                            </span>
                          </div>

                          <pre className="text-[11px] text-stone-300 leading-relaxed overflow-hidden my-auto line-clamp-6 opacity-90 font-mono">
                            {post.code_snippet}
                          </pre>

                          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400 font-sans">
                            <span className="font-bold text-white truncate max-w-[70%]">{post.title}</span>
                            <span className="text-[10px] text-orange-400 font-mono">#{post.tags?.[0]}</span>
                          </div>
                        </div>
                      ) : post.image_url ? (
                        /* Rich Visual Media Card */
                        <div className="w-full h-full relative overflow-hidden bg-stone-950">
                          <img
                            src={post.image_url}
                            alt={post.title}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-4">
                            <span className="text-xs font-extrabold text-white line-clamp-1">{post.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-stone-300">
                              <span>@{post.author?.username}</span>
                              {post.community_slug && (
                                <span className="text-orange-400 font-mono">· #{post.community_slug}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Minimalist SaaS Post Card */
                        <div className="w-full h-full p-5 flex flex-col justify-between bg-gradient-to-br from-white via-[#fffcf7] to-[#fff4e6] dark:from-[#1f1813] dark:to-[#17120e]">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={post.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-orange-500/30"
                              />
                              <span className="text-xs font-bold text-[#1c130d] dark:text-white truncate">
                                @{post.author?.username}
                              </span>
                            </div>
                            <h3 className="text-sm font-black text-[#1c130d] dark:text-white leading-snug line-clamp-3">
                              {post.title}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#f1e4d3] dark:border-[#33251c] text-xs">
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-mono font-bold">
                              #{post.tags?.[0] || 'dev'}
                            </span>
                            <span className="text-[10px] text-[#8d7565] dark:text-[#a89080]">
                              {timeAgo(post.created_at)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Top Right Type Indicator Badge */}
                      <div className="absolute top-3 right-3 z-10 pointer-events-none">
                        <span className="w-7 h-7 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-md">
                          {post.type === 'code' ? <Code2 size={13} /> :
                           post.type === 'security' ? <ShieldCheck size={13} /> :
                           post.image_url ? <Briefcase size={13} /> : <Terminal size={13} />}
                        </span>
                      </div>

                      {/* SIGNATURE HOVER OVERLAY */}
                      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4 z-20 text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src={post.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover border border-white/30"
                            />
                            <span className="text-xs font-bold text-white truncate">
                              @{post.author?.username}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-orange-300">
                            Inspect
                          </span>
                        </div>

                        <div className="flex items-center justify-center gap-6 font-extrabold text-sm sm:text-base">
                          <span className="flex items-center gap-1.5 drop-shadow-md">
                            <Heart size={18} className={isLiked ? 'fill-rose-500 text-rose-500' : 'fill-white'} />
                            <span>{currentLikes}</span>
                          </span>
                          <span className="flex items-center gap-1.5 drop-shadow-md">
                            <MessageSquare size={18} className="fill-white" />
                            <span>{post.comments_count}</span>
                          </span>
                        </div>

                        <p className="text-[11px] text-stone-200 font-medium line-clamp-1 truncate">
                          {post.title}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* =========================================================================
            3. RIGHT RAIL: REAL BUILDERS LEADERBOARD & STATS (100% REAL DB DATA)
            ========================================================================= */}
        <div className="hidden xl:block w-[310px] shrink-0 space-y-5">
          {/* Top Builders Spotlight from Database */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#382b22] shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#f1e4d3] dark:border-[#33251c] pb-2.5">
              <span className="font-extrabold text-xs text-[#1c130d] dark:text-white flex items-center gap-1.5">
                <Award size={14} className="text-orange-500" />
                <span>Top Builders ({dbProfiles.length})</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveCategory('builders')}
                className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-3">
              {spotlightBuilders.length === 0 ? (
                <p className="text-xs text-[#8d7565] italic">No builders registered in database yet.</p>
              ) : (
                spotlightBuilders.slice(0, 4).map((builder, i) => (
                  <div key={builder.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-bold text-[#8d7565] w-3">{i + 1}</span>
                      <img
                        src={builder.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                        alt=""
                        className="w-8 h-8 rounded-xl object-cover border border-[#f1e4d3] dark:border-[#382b22]"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/profile/${builder.username}`}
                          className="text-xs font-bold text-[#1c130d] dark:text-white hover:text-orange-500 transition-colors truncate block"
                        >
                          {builder.full_name || builder.username}
                        </Link>
                        <span className="text-[10px] text-[#8d7565] block truncate">
                          Lvl {builder.level || 1} · {builder.xp || 0} XP
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleFollow(builder.id, builder.username, e)}
                      className="p-1.5 rounded-lg bg-[#faf6f0] dark:bg-[#251b15] hover:bg-orange-500 hover:text-white text-[#6b5546] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22] text-[11px] font-bold transition-all cursor-pointer"
                      title="Connect"
                    >
                      {followingMap[builder.id] ? <Check size={12} className="text-emerald-500" /> : <UserPlus size={12} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Real Communities Quick Hub from Database */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#fffcf7] to-[#fff4e6] dark:from-[#1c1511] dark:to-[#221812] border border-[#f1e4d3] dark:border-[#382b22] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                <Globe size={13} />
                <span>Communities</span>
              </span>
              <span className="text-[10px] font-mono text-[#8d7565]">{dbCommunities.length} in DB</span>
            </div>

            <div className="space-y-2">
              {dbCommunities.length === 0 ? (
                <p className="text-xs text-[#8d7565] italic">No communities in database yet.</p>
              ) : (
                dbCommunities.slice(0, 3).map((c) => (
                  <Link
                    key={c.id}
                    to={`/communities?community=${c.id}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-stone-900/80 hover:bg-white border border-[#f1e4d3] dark:border-[#33251c] transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold block truncate text-[#1c130d] dark:text-white">{c.name}</span>
                      <span className="text-[10px] text-[#8d7565]">{c.member_count || 0} members</span>
                    </div>
                    <ChevronRight size={13} className="text-[#8d7565] shrink-0" />
                  </Link>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveCategory('communities')}
              className="w-full py-2 px-3 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <span>Explore All Communities</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Connectra Knowledge Base Card */}
          <div className="p-4 rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#382b22] space-y-2 text-xs">
            <span className="font-extrabold text-xs text-[#1c130d] dark:text-white flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              <span>Connectra Knowledge Base</span>
            </span>
            <p className="text-[11px] text-[#6b5546] dark:text-[#a89080] leading-relaxed">
              100% database-backed real-time developer social platform. Share reproducible code snippets to gain XP and community reputation.
            </p>
          </div>
        </div>

      </div>

      {/* =========================================================================
          IMMERSIVE LIGHTBOX POST MODAL (100% REAL COMMENTS & INTERACTIONS)
          ========================================================================= */}
      <AnimatePresence>
        {selectedPost && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
            onClick={() => setSelectedPost(null)}
          >
            <button
              type="button"
              onClick={() => setSelectedPost(null)}
              className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[88vh] bg-white dark:bg-[#150f0c] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row text-[#1c130d] dark:text-stone-100"
            >
              {/* LEFT PANE: High-Res View or Syntax Highlighted Code */}
              <div className="w-full md:w-3/5 bg-[#0f0e0d] flex flex-col justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-[#f1e4d3] dark:border-[#33251c] text-white">
                {selectedPost.code_snippet ? (
                  <div className="p-6 h-full flex flex-col justify-between font-mono bg-[#0c0b0a] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="ml-2 text-xs font-bold text-orange-400">{selectedPost.language || 'Code'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(selectedPost.code_snippet, selectedPost.id, e)}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-sans font-bold flex items-center gap-1.5 cursor-pointer text-stone-200"
                      >
                        {copiedCodeId === selectedPost.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedCodeId === selectedPost.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <pre className="text-xs text-stone-200 leading-relaxed overflow-x-auto p-2 font-mono">
                      {selectedPost.code_snippet}
                    </pre>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] font-sans text-emerald-400">
                      <ShieldCheck size={14} />
                      <span>Zero-Trust Database Verified</span>
                    </div>
                  </div>
                ) : selectedPost.image_url ? (
                  <div className="w-full h-full relative min-h-[300px] flex items-center justify-center bg-stone-950">
                    <img
                      src={selectedPost.image_url}
                      alt=""
                      className="w-full h-full object-cover max-h-[70vh]"
                    />
                  </div>
                ) : (
                  <div className="p-8 h-full bg-gradient-to-br from-stone-900 via-stone-950 to-orange-950 flex flex-col justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold w-fit border border-white/20">
                      {selectedPost.tags?.join(' · ') || 'Discussion'}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white">{selectedPost.title}</h2>
                    <span className="text-xs text-stone-400">Connectra Developer Discussion</span>
                  </div>
                )}
              </div>

              {/* RIGHT PANE: Author, Caption & Real Comments Feed */}
              <div className="w-full md:w-2/5 flex flex-col justify-between p-5 bg-[#faf6f0] dark:bg-[#1a1410]">
                {/* Header: Author & Connect Button */}
                <div className="flex items-center justify-between pb-4 border-b border-[#f1e4d3] dark:border-[#33251c]">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedPost.author?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-orange-500/40"
                    />
                    <div>
                      <Link
                        to={`/profile/${selectedPost.author?.username}`}
                        className="text-xs font-bold text-[#1c130d] dark:text-white hover:text-orange-500 transition-colors flex items-center gap-1"
                      >
                        <span>@{selectedPost.author?.username}</span>
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      </Link>
                      <span className="text-[10px] text-[#8d7565] dark:text-[#a89080]">{selectedPost.author?.badge || 'Member'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleFollow(selectedPost.author?.id, selectedPost.author?.username, e)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      followingMap[selectedPost.author?.id] || followingMap[selectedPost.author?.username]
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        : 'bg-[#ea580c] hover:bg-orange-600 text-white'
                    }`}
                  >
                    {followingMap[selectedPost.author?.id] || followingMap[selectedPost.author?.username] ? 'Following' : 'Connect'}
                  </button>
                </div>

                {/* Caption, Tags & Real Comments Feed */}
                <div className="flex-1 py-4 overflow-y-auto space-y-3 custom-scrollbar text-xs">
                  <p className="text-[#3d2e24] dark:text-stone-300 leading-relaxed font-sans">
                    <span className="font-bold mr-1.5 text-[#1c130d] dark:text-white">@{selectedPost.author?.username}</span>
                    {selectedPost.caption}
                  </p>

                  {selectedPost.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedPost.tags.map((tag, i) => (
                        <span key={i} className="text-[#ea580c] dark:text-orange-400 font-mono text-[11px] hover:underline cursor-pointer">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Real Comments Section from DB */}
                  <div className="pt-3 border-t border-[#f1e4d3] dark:border-[#33251c] space-y-2.5">
                    <span className="font-bold text-[11px] text-[#8d7565] dark:text-[#a89080] uppercase tracking-wider">
                      Discussion ({modalComments.length})
                    </span>

                    {modalComments.length === 0 ? (
                      <p className="text-[11px] text-[#8d7565] italic">No comments yet in database. Start the discussion!</p>
                    ) : (
                      modalComments.map((c, i) => (
                        <div key={c.id || i} className="flex items-start gap-2 text-xs">
                          <img
                            src={c.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                          />
                          <div className="leading-tight">
                            <span className="font-bold text-[#1c130d] dark:text-white mr-1.5">
                              @{c.profiles?.username || 'developer'}:
                            </span>
                            <span className="text-[#6b5546] dark:text-stone-300">{c.content}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="pt-3 border-t border-[#f1e4d3] dark:border-[#33251c] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => handleToggleLike(selectedPost, e)}
                        className="p-1 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Like Post"
                      >
                        <Heart
                          size={22}
                          className={likedPostsMap[selectedPost.id] ? 'fill-rose-500 text-rose-500' : 'text-[#6b5546] dark:text-stone-300'}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleMessageAuthor(selectedPost.author?.username, e)}
                        className="p-1 hover:text-orange-500 transition-colors cursor-pointer text-[#6b5546] dark:text-stone-300"
                        title="Message Author"
                      >
                        <MessageSquare size={20} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + `/post/${selectedPost.id}`);
                          toast.success('Post link copied to clipboard!');
                        }}
                        className="p-1 hover:text-blue-500 transition-colors cursor-pointer text-[#6b5546] dark:text-stone-300"
                        title="Share Post"
                      >
                        <Share2 size={20} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleSave(selectedPost.id, e)}
                      className="p-1 hover:text-amber-500 transition-colors cursor-pointer text-[#6b5546] dark:text-stone-300"
                      title="Save Post"
                    >
                      <Bookmark
                        size={20}
                        className={savedPostsMap[selectedPost.id] ? 'fill-amber-500 text-amber-500' : ''}
                      />
                    </button>
                  </div>

                  <div className="text-xs font-bold text-[#1c130d] dark:text-white">
                    {(likesCountMap[selectedPost.id] ?? selectedPost.likes_count)} likes
                  </div>

                  {/* Add Comment Form */}
                  <form
                    onSubmit={handleAddComment}
                    className="flex items-center gap-2 pt-2 border-t border-[#f1e4d3] dark:border-[#33251c]"
                  >
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your perspective..."
                      className="flex-1 bg-transparent text-xs text-[#1c130d] dark:text-white placeholder-[#8d7565] outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim() || submittingComment}
                      className="text-xs font-bold text-[#ea580c] hover:text-orange-600 disabled:opacity-30 cursor-pointer"
                    >
                      Post
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
