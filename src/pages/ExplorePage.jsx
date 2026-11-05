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
  Shield,
  Code2,
  Film,
  Users,
  Briefcase,
  ExternalLink,
  UserPlus,
  UserCheck,
  Check,
  X,
  Flame,
  Play,
  Volume2,
  VolumeX,
  Copy,
  Terminal,
  Layers,
  ChevronRight,
  TrendingUp,
  Tag,
  Smile,
  Send,
  MoreHorizontal,
  Compass,
} from 'lucide-react';
import Loader from '../components/ui/Loader';
import { toast } from '../lib/toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createNotification } from '../lib/notifications';

// Instagram-Style Trending Story Channels (Gradient Rings at Top)
const EXPLORE_STORIES = [
  { id: 'all', label: 'All Feeds', tag: 'all', icon: Sparkles, gradient: 'from-amber-500 via-orange-500 to-rose-500', isLive: true },
  { id: 'security', label: '#zero-trust', tag: 'security', icon: Shield, gradient: 'from-emerald-400 via-teal-500 to-cyan-500', isLive: true },
  { id: 'rust', label: '#rust-lang', tag: 'rust', icon: Terminal, gradient: 'from-orange-500 via-amber-600 to-red-600', isLive: false },
  { id: 'ai', label: '#ai-agents', tag: 'ai', icon: Sparkles, gradient: 'from-purple-500 via-fuchsia-500 to-pink-500', isLive: true },
  { id: 'react', label: '#react19', tag: 'react', icon: Code2, gradient: 'from-cyan-400 via-blue-500 to-indigo-500', isLive: false },
  { id: 'devops', label: '#docker', tag: 'devops', icon: Layers, gradient: 'from-blue-500 via-teal-500 to-emerald-500', isLive: false },
  { id: 'reels', label: '#dev-reels', tag: 'reels', icon: Film, gradient: 'from-pink-500 via-rose-500 to-amber-500', isLive: true },
  { id: 'collabs', label: '#co-founders', tag: 'collabs', icon: Briefcase, gradient: 'from-amber-400 via-orange-500 to-yellow-500', isLive: false },
];

// Instagram Category Filter Pills
const CATEGORY_TABS = [
  { id: 'all', label: '🔥 For You', icon: Flame },
  { id: 'code', label: '💻 Code Snippets', icon: Code2 },
  { id: 'security', label: '🛡️ Security & Exploits', icon: Shield },
  { id: 'reels', label: '🎥 Dev Reels', icon: Film },
  { id: 'projects', label: '🚀 Projects & Bounties', icon: Briefcase },
  { id: 'builders', label: '👥 Top Builders', icon: Users },
];

// Rich Curated Developer Exploration Data (Instagram Masonry Format)
const CURATED_EXPLORE_POSTS = [
  {
    id: 'exp-1',
    type: 'code',
    size: 'tall', // 1x2 vertical card in masonry
    title: 'Zero-Trust SQL Parameterization in Rust & PostgreSQL',
    author: {
      username: 'alex_cybersec',
      full_name: 'Alex Rivera',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Security Verified',
    },
    likes_count: 248,
    comments_count: 34,
    tags: ['rust', 'security', 'sql', 'zero-trust'],
    language: 'Rust',
    code_snippet: `// Zero-Trust Safe SQL Query with sqlx
pub async fn fetch_user_by_id(
    pool: &PgPool,
    user_id: Uuid
) -> Result<UserRecord, sqlx::Error> {
    // Parameterized binding guarantees data isolation
    sqlx::query_as!(
        UserRecord,
        "SELECT id, username, email FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(pool)
    .await
}`,
    caption: 'Never concatenate user input into queries! With sqlx in Rust, compile-time SQL verification guarantees 0 SQLi injection vulnerabilities. Checked with Connectra SAST scanner 🛡️',
    gradient: 'from-slate-900 via-stone-900 to-emerald-950',
    accentColor: '#10b981',
  },
  {
    id: 'exp-2',
    type: 'project',
    size: 'hero', // 2x2 large hero card
    title: 'Connectra Micro-Blockchain Audit Trail',
    author: {
      username: 'prachi',
      full_name: 'Prachi Patel',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      badge: 'Core Maintainer',
    },
    likes_count: 512,
    comments_count: 78,
    tags: ['blockchain', 'cryptography', 'sha256', 'react19'],
    image_url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80',
    caption: 'Designing our tamper-evident micro-blockchain audit log! Every administrative elevation or role update chains the previous block SHA-256 hash. If anyone tampers with past logs, the entire chain triggers an instant alarm. ⛓️⚡',
    gradient: 'from-orange-950 via-stone-900 to-amber-950',
    accentColor: '#f97316',
  },
  {
    id: 'exp-3',
    type: 'reel',
    size: 'tall',
    title: 'React 19 Server Actions & Optimistic UI in 45 Seconds',
    author: {
      username: 'rohan_dev',
      full_name: 'Rohan Sharma',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      badge: 'Frontend Architect',
    },
    likes_count: 389,
    comments_count: 45,
    views: '3.8k',
    duration: '0:45',
    tags: ['react', 'nextjs', 'typescript'],
    image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    caption: 'Why useEffect is no longer needed for data mutations in React 19! Here is how useOptimistic and Server Actions create instant sub-50ms user experiences. 🚀🔥',
    gradient: 'from-indigo-950 via-stone-900 to-purple-950',
    accentColor: '#8b5cf6',
  },
  {
    id: 'exp-4',
    type: 'security',
    size: 'square',
    title: 'Pre-Publish Secret Scanner Benchmark',
    author: {
      username: 'arunima_c',
      full_name: 'Arunima Chakraborty',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      badge: 'Lead Researcher',
    },
    likes_count: 670,
    comments_count: 92,
    tags: ['security', 'shannon-entropy', 'zero-trust'],
    language: 'Python',
    code_snippet: `// Shannon Entropy Credential Check
function isExposedSecret(token) {
  const H = computeShannonEntropy(token);
  // Threshold calibrated at H >= 4.4
  return H >= 4.4 && !isBenignUUID(token);
}`,
    caption: 'Our paper evaluation metrics are live! Pure entropy produces 20% false alarms on UUIDs, but Connectra hybrid token filtering drops false positives to 6.7% with 24 microsecond latency! 📄✨',
    gradient: 'from-stone-900 via-rose-950 to-stone-950',
    accentColor: '#ec4899',
  },
  {
    id: 'exp-5',
    type: 'project',
    size: 'square',
    title: '4D Developer Skill Graph & Team Radar',
    author: {
      username: 'priya_cloud',
      full_name: 'Priya Verma',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      badge: 'Cloud Engineer',
    },
    likes_count: 310,
    comments_count: 29,
    tags: ['devops', 'kubernetes', 'cloud'],
    image_url: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&auto=format&fit=crop&q=80',
    caption: 'No more homogeneous engineering silos! Check out our 4D Radar matching teams across Frontend, Backend, DevOps, and Cybersecurity. +36% team domain entropy boost! 🕸️📊',
    gradient: 'from-cyan-950 via-stone-900 to-blue-950',
    accentColor: '#06b6d4',
  },
  {
    id: 'exp-6',
    type: 'code',
    size: 'tall',
    title: 'High-Throughput WebSockets with Go & Supabase CDC',
    author: {
      username: 'david_sys',
      full_name: 'David Kim',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      badge: 'Systems Specialist',
    },
    likes_count: 421,
    comments_count: 53,
    tags: ['golang', 'websockets', 'distributed'],
    language: 'Go',
    code_snippet: `// Real-Time Event Dispatcher in Go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
        case message := <-h.broadcast:
            for client := range h.clients {
                client.send <- message
            }
        }
    }
}`,
    caption: 'Handling 50,000 concurrent developer chat sockets with Go channels and goroutines. Memory footprint is under 20MB! ⚡🔥',
    gradient: 'from-amber-950 via-stone-900 to-yellow-950',
    accentColor: '#eab308',
  },
  {
    id: 'exp-7',
    type: 'reel',
    size: 'square',
    title: 'How E2EE Direct Messaging Works Under the Hood',
    author: {
      username: 'elena_crypto',
      full_name: 'Elena Rostova',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      badge: 'Cryptographer',
    },
    likes_count: 735,
    comments_count: 104,
    views: '6.2k',
    duration: '1:02',
    tags: ['cryptography', 'e2ee', 'security'],
    image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    caption: 'A 60-second visual breakdown of AES-GCM-256 and PBKDF2 session key derivation in the browser with WebCrypto API. Even database admins only see ciphertext! 🔒✨',
    gradient: 'from-emerald-950 via-stone-900 to-teal-950',
    accentColor: '#10b981',
  },
  {
    id: 'exp-8',
    type: 'project',
    size: 'tall',
    title: 'Open Collab: Seeking Rust & WebRTC Co-Founder',
    author: {
      username: 'marcus_ai',
      full_name: 'Marcus Vance',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      badge: 'Founder',
    },
    likes_count: 289,
    comments_count: 41,
    tags: ['rust', 'webrtc', 'collab', 'ai'],
    image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    caption: 'Building decentralized audio-first pairing for developers! Looking for a Rust systems engineer with WebRTC experience. Connect with 88% synergy match! 🎙️💻',
    gradient: 'from-purple-950 via-stone-900 to-pink-950',
    accentColor: '#a855f7',
  },
];

export default function ExplorePage({ session }) {
  const navigate = useNavigate();
  const currentUserId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [activeStory, setActiveStory] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [followingMap, setFollowingMap] = useState({});
  const [likedPostsMap, setLikedPostsMap] = useState({});
  const [savedPostsMap, setSavedPostsMap] = useState({});

  // Instagram-style Lightbox Modal state
  const [selectedPost, setSelectedPost] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Synchronize query from URL
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Handle Search Input
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Like Toggle Animation
  const handleToggleLike = (postId, e) => {
    e?.stopPropagation();
    setLikedPostsMap(prev => {
      const isLiked = !prev[postId];
      if (isLiked) toast.success('Added to your liked posts ❤️');
      return { ...prev, [postId]: isLiked };
    });
  };

  // Bookmark / Save Toggle
  const handleToggleSave = (postId, e) => {
    e?.stopPropagation();
    setSavedPostsMap(prev => {
      const isSaved = !prev[postId];
      if (isSaved) toast.success('Saved to your collection 🔖');
      return { ...prev, [postId]: isSaved };
    });
  };

  // Follow Toggle
  const handleToggleFollow = (authorUsername, e) => {
    e?.stopPropagation();
    setFollowingMap(prev => {
      const isFollowing = !prev[authorUsername];
      toast.success(isFollowing ? `Connected with @${authorUsername} 🤝` : `Unfollowed @${authorUsername}`);
      return { ...prev, [authorUsername]: isFollowing };
    });
  };

  // Message author helper
  const handleMessageAuthor = (username, e) => {
    e?.stopPropagation();
    document.dispatchEvent(new CustomEvent('startChat', {
      detail: { username }
    }));
    navigate('/chat');
  };

  // Copy code helper
  const handleCopyCode = (code, id, e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success('Code snippet copied to clipboard! 📋');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Filter posts based on story tag, category pill, and search query
  const filteredPosts = useMemo(() => {
    let list = [...CURATED_EXPLORE_POSTS];

    // Story filter
    if (activeStory !== 'all') {
      list = list.filter(p => p.tags.includes(activeStory) || p.type === activeStory);
    }

    // Category filter
    if (activeCategory !== 'all') {
      if (activeCategory === 'code') list = list.filter(p => p.type === 'code');
      else if (activeCategory === 'security') list = list.filter(p => p.type === 'security' || p.tags.includes('security'));
      else if (activeCategory === 'reels') list = list.filter(p => p.type === 'reel');
      else if (activeCategory === 'projects') list = list.filter(p => p.type === 'project');
      else if (activeCategory === 'builders') list = list.filter(p => p.likes_count > 350);
    }

    // Text Query search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const captionMatch = (p.caption || '').toLowerCase().includes(q);
        const tagMatch = p.tags.some(t => t.toLowerCase().includes(q));
        const authorMatch = p.author.username.toLowerCase().includes(q) || p.author.full_name.toLowerCase().includes(q);
        return titleMatch || captionMatch || tagMatch || authorMatch;
      });
    }

    return list;
  }, [activeStory, activeCategory, query]);

  return (
    <div className="min-h-screen bg-[#090807] text-stone-100 flex flex-col relative select-none">
      {/* Ambient Cosmic Lights */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[350px] bg-gradient-to-r from-orange-600/10 via-amber-500/5 to-rose-600/10 blur-[140px] pointer-events-none" />

      <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[280px] shrink-0">
          <Sidebar
            profile={{ id: currentUserId, username: session?.user?.email?.split('@')[0] || 'User' }}
            stats={{ followers: 24, following: 18 }}
          />
        </div>

        {/* Center Instagram Explore Stream */}
        <div className="flex-1 w-full min-w-0 space-y-5">
          {/* Top Bar: Search & Explore Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/60 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-0.5 flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-stone-950 rounded-[14px] flex items-center justify-center">
                  <Compass size={20} className="text-orange-400 animate-spin-slow" />
                </div>
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white flex items-center gap-1.5">
                  <span>Explore Cosmos</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    Live Feed
                  </span>
                </h1>
                <p className="text-xs text-stone-400">Trending code, security bounties, and creator reels</p>
              </div>
            </div>

            {/* Instagram-Style Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={handleSearchChange}
                placeholder="Search code, #tags, exploits, or engineers..."
                className="w-full pl-9 pr-9 py-2 rounded-2xl bg-stone-950/80 border border-stone-800 focus:border-orange-500 text-xs text-white placeholder-stone-500 outline-none transition-all shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSearchParams({}); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 1. INSTAGRAM STORY CIRCLES (Horizontal Scrollable Topics) */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 custom-scrollbar">
            {EXPLORE_STORIES.map((story) => {
              const Icon = story.icon;
              const isSelected = activeStory === story.tag;

              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setActiveStory(story.tag)}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                >
                  {/* Glowing Story Ring */}
                  <div
                    className={`w-[62px] h-[62px] rounded-full p-[2.5px] transition-all transform group-hover:scale-105 ${
                      isSelected
                        ? `bg-gradient-to-tr ${story.gradient} shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/50`
                        : `bg-gradient-to-tr ${story.gradient} opacity-80 group-hover:opacity-100`
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-[#090807] p-1 flex items-center justify-center">
                      <div className="w-full h-full rounded-full bg-stone-900 flex items-center justify-center text-white group-hover:text-orange-400 transition-colors">
                        <Icon size={20} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {story.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                    <span
                      className={`text-[11px] font-semibold tracking-tight transition-colors ${
                        isSelected ? 'text-orange-400 font-bold' : 'text-stone-400 group-hover:text-stone-200'
                      }`}
                    >
                      {story.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. INSTAGRAM CATEGORY PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 custom-scrollbar">
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
                      ? 'bg-white text-black shadow-md scale-102'
                      : 'bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800/80'
                  }`}
                >
                  <Icon size={13} className={isSelected ? 'text-black' : 'text-stone-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3. INSTAGRAM-STYLE ASYMMETRIC MASONRY GRID */}
          {filteredPosts.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-stone-900/30 border border-stone-800/60 text-stone-400">
              <Compass size={40} className="mx-auto mb-3 opacity-30 text-orange-400" />
              <h3 className="font-bold text-base text-white mb-1">No posts found in this galaxy</h3>
              <p className="text-xs max-w-sm mx-auto mb-4">
                Try clicking a different story circle or clearing your search query.
              </p>
              <button
                type="button"
                onClick={() => { setActiveStory('all'); setActiveCategory('all'); setQuery(''); }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs cursor-pointer hover:bg-orange-600 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5 auto-rows-[220px] sm:auto-rows-[260px]">
              {filteredPosts.map((post, idx) => {
                const isHero = post.size === 'hero'; // 2x2 large hero tile
                const isTall = post.size === 'tall'; // 1x2 vertical tile
                const isLiked = likedPostsMap[post.id];
                const isSaved = savedPostsMap[post.id];

                return (
                  <motion.div
                    key={post.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    onClick={() => setSelectedPost(post)}
                    className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer bg-stone-900 border border-white/5 hover:border-orange-500/40 shadow-md hover:shadow-2xl transition-all ${
                      isHero ? 'col-span-2 row-span-2' : isTall ? 'row-span-2' : 'col-span-1 row-span-1'
                    }`}
                  >
                    {/* CARD CONTENT LAYER */}
                    {post.type === 'code' ? (
                      /* Mini Syntax Highlighted IDE Card */
                      <div className="w-full h-full bg-[#0d0c0b] p-3.5 flex flex-col justify-between font-mono text-xs overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] text-stone-400">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                            <span className="ml-1 text-stone-400 font-bold">{post.language}</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[9px] border border-emerald-500/20">
                            Zero-Trust Clean
                          </span>
                        </div>

                        <pre className="text-[11px] text-stone-300 leading-relaxed overflow-hidden my-auto line-clamp-6 opacity-90">
                          {post.code_snippet}
                        </pre>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-400 font-sans">
                          <span className="font-bold text-stone-200 truncate">{post.title}</span>
                        </div>
                      </div>
                    ) : post.image_url ? (
                      /* Rich Image / Reel / Project Card */
                      <div className="w-full h-full relative overflow-hidden bg-stone-950">
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                        {post.type === 'reel' && (
                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white flex items-center gap-1">
                            <Play size={10} className="fill-white" />
                            <span>{post.duration}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Stylized Typography Card */
                      <div className={`w-full h-full bg-gradient-to-br ${post.gradient} p-5 flex flex-col justify-between`}>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-bold text-[10px] border border-white/10">
                            {post.tags[0]}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <img src={post.author.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs text-stone-300">@{post.author.username}</span>
                        </div>
                      </div>
                    )}

                    {/* Top-Right Category Badge */}
                    <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                      <span className="w-7 h-7 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-md">
                        {post.type === 'code' && <Code2 size={13} />}
                        {post.type === 'project' && <Briefcase size={13} />}
                        {post.type === 'reel' && <Film size={13} />}
                        {post.type === 'security' && <Shield size={13} />}
                      </span>
                    </div>

                    {/* INSTAGRAM SIGNATURE HOVER OVERLAY */}
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4 z-20">
                      {/* Top Row: Author Info */}
                      <div className="flex items-center gap-2">
                        <img
                          src={post.author.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-white/30"
                        />
                        <span className="text-xs font-bold text-white truncate">
                          @{post.author.username}
                        </span>
                      </div>

                      {/* Center Stats: Likes & Comments */}
                      <div className="flex items-center justify-center gap-6 text-white font-extrabold text-sm sm:text-base">
                        <span className="flex items-center gap-1.5 drop-shadow-md">
                          <Heart size={18} className={isLiked ? 'fill-rose-500 text-rose-500' : 'fill-white'} />
                          <span>{post.likes_count + (isLiked ? 1 : 0)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 drop-shadow-md">
                          <MessageSquare size={18} className="fill-white" />
                          <span>{post.comments_count}</span>
                        </span>
                      </div>

                      {/* Bottom Row: Title Snippet */}
                      <p className="text-[11px] text-stone-200 font-medium line-clamp-1 truncate">
                        {post.title}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. INSTAGRAM-STYLE IMMERSIVE LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedPost && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md"
            onClick={() => setSelectedPost(null)}
          >
            {/* Close Cross Mark */}
            <button
              type="button"
              onClick={() => setSelectedPost(null)}
              className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-stone-900/80 text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[88vh] bg-[#121110] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row text-white"
            >
              {/* LEFT PANE: High-Res Visual / Code Editor View */}
              <div className="w-full md:w-3/5 bg-black flex flex-col justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
                {selectedPost.type === 'code' ? (
                  <div className="p-6 h-full flex flex-col justify-between font-mono bg-stone-950 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500" />
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="ml-2 text-xs font-bold text-orange-400">{selectedPost.language}</span>
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

                    <pre className="text-xs text-stone-200 leading-relaxed overflow-x-auto p-2">
                      {selectedPost.code_snippet}
                    </pre>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] font-sans text-emerald-400">
                      <Shield size={14} />
                      <span>Audited with Connectra Dual-Agent SAST: Zero Vulnerabilities</span>
                    </div>
                  </div>
                ) : selectedPost.image_url ? (
                  <div className="w-full h-full relative min-h-[300px] flex items-center justify-center bg-stone-950">
                    <img
                      src={selectedPost.image_url}
                      alt=""
                      className="w-full h-full object-cover max-h-[70vh]"
                    />
                    {selectedPost.type === 'reel' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-xl cursor-pointer hover:scale-110 transition-transform">
                          <Play size={26} className="fill-white text-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-8 h-full bg-gradient-to-br ${selectedPost.gradient} flex flex-col justify-between`}>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold w-fit border border-white/20">
                      {selectedPost.tags.join(' · ')}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white">{selectedPost.title}</h2>
                    <span className="text-xs text-stone-400">Connectra Security Cosmos</span>
                  </div>
                )}
              </div>

              {/* RIGHT PANE: Instagram Post Header, Caption & Social Actions */}
              <div className="w-full md:w-2/5 flex flex-col justify-between p-5 bg-[#141211]">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedPost.author.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-orange-500/40"
                    />
                    <div>
                      <Link
                        to={`/profile/${selectedPost.author.username}`}
                        className="text-xs font-bold text-white hover:text-orange-400 transition-colors flex items-center gap-1"
                      >
                        <span>@{selectedPost.author.username}</span>
                        <Check size={12} className="text-emerald-400" />
                      </Link>
                      <span className="text-[10px] text-stone-400">{selectedPost.author.badge}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleFollow(selectedPost.author.username, e)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      followingMap[selectedPost.author.username]
                        ? 'bg-stone-800 text-stone-300'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {followingMap[selectedPost.author.username] ? 'Following' : 'Follow'}
                  </button>
                </div>

                {/* Caption & Tags Scroll Area */}
                <div className="flex-1 py-4 overflow-y-auto space-y-3 custom-scrollbar text-xs">
                  <p className="text-stone-300 leading-relaxed font-sans">
                    <span className="font-bold text-white mr-1.5">@{selectedPost.author.username}</span>
                    {selectedPost.caption}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedPost.tags.map((tag, i) => (
                      <span key={i} className="text-orange-400 font-mono text-[11px] hover:underline cursor-pointer">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Sample Community Comments */}
                  <div className="pt-3 border-t border-white/5 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-stone-200">@dev_sam:</span>
                      <span className="text-stone-400">Clean architecture! Loved the parameterization breakdown 🔥</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-stone-200">@sarah_builds:</span>
                      <span className="text-stone-400">Does Connectra SAST check multi-file data flows as well?</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Interactive Action Toolbar */}
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => handleToggleLike(selectedPost.id, e)}
                        className="p-1 text-white hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Heart
                          size={22}
                          className={likedPostsMap[selectedPost.id] ? 'fill-rose-500 text-rose-500' : ''}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleMessageAuthor(selectedPost.author.username, e)}
                        className="p-1 text-white hover:text-orange-400 transition-colors cursor-pointer"
                        title="Send Direct Message"
                      >
                        <MessageSquare size={20} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success('Post link copied to clipboard!');
                        }}
                        className="p-1 text-white hover:text-blue-400 transition-colors cursor-pointer"
                        title="Share Post"
                      >
                        <Share2 size={20} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleSave(selectedPost.id, e)}
                      className="p-1 text-white hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Bookmark
                        size={20}
                        className={savedPostsMap[selectedPost.id] ? 'fill-amber-400 text-amber-400' : ''}
                      />
                    </button>
                  </div>

                  <div className="text-xs font-bold text-white">
                    {selectedPost.likes_count + (likedPostsMap[selectedPost.id] ? 1 : 0)} likes
                  </div>

                  {/* Comment Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newComment.trim()) return;
                      toast.success('Comment posted! 🚀');
                      setNewComment('');
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-white/5"
                  >
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment for the author..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-stone-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="text-xs font-bold text-orange-400 hover:text-orange-300 disabled:opacity-30 cursor-pointer"
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
