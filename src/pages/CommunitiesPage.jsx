import { useState, useEffect, useMemo, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import {
  Users,
  Plus,
  Search,
  Globe,
  Lock,
  X,
  ChevronRight,
  Shield,
  Sparkles,
  Check,
  Compass,
  ArrowRight,
  Flame,
  LayoutGrid,
  List,
  Filter,
  CheckCircle2,
  ExternalLink,
  Code2,
  Activity,
  MessageSquare,
  BookOpen,
  Layers,
  Award,
  Calendar,
  Share2,
  Tag,
  ShieldCheck,
  Zap,
  Terminal,
  Cpu,
  Bot,
  Boxes,
  KeyRound,
  Database,
  BarChart3,
} from 'lucide-react';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import Feed from '../components/Feed';
import CommunityFeed from '../components/community/CommunityFeed';
import { CURATED_COMMUNITIES, COMMUNITY_CATEGORIES, getCommunityById } from '../data/communitiesData';

const DEFAULT_ICONS = ['🛡️', '🤖', '⚡', '🌐', '☁️', '🦀', '🔐', '🎨', '🚀', '💻', '🎯', '🧬', '🛠️', '📦'];

// SaaS Developer Vector Icon Resolver
function renderTechIcon(comm, size = 18) {
  if (!comm) return <Terminal size={size} className="text-[#ea580c]" />;
  const slug = (comm.slug || '').toLowerCase();
  const cat = (comm.category || '').toLowerCase();
  const name = (comm.name || '').toLowerCase();

  if (slug.includes('agent') || slug.includes('ai') || cat.includes('ai') || name.includes('ai')) {
    return <Bot size={size} className="text-purple-600 dark:text-purple-400" />;
  }
  if (slug.includes('sec') || cat.includes('security') || name.includes('security')) {
    return <ShieldCheck size={size} className="text-emerald-600 dark:text-emerald-400" />;
  }
  if (slug.includes('rust') || slug.includes('system') || cat.includes('systems')) {
    return <Cpu size={size} className="text-orange-600 dark:text-orange-400" />;
  }
  if (slug.includes('crypto') || slug.includes('zkp') || name.includes('crypto')) {
    return <KeyRound size={size} className="text-indigo-600 dark:text-indigo-400" />;
  }
  if (slug.includes('cloud') || slug.includes('kube') || name.includes('cloud')) {
    return <Boxes size={size} className="text-cyan-600 dark:text-cyan-400" />;
  }
  if (slug.includes('web') || slug.includes('next') || cat.includes('web')) {
    return <Globe size={size} className="text-blue-600 dark:text-blue-400" />;
  }
  if (slug.includes('python') || slug.includes('data') || name.includes('python')) {
    return <Database size={size} className="text-amber-600 dark:text-amber-400" />;
  }
  if (slug.includes('red-team') || slug.includes('offensive')) {
    return <Lock size={size} className="text-rose-600 dark:text-rose-400" />;
  }
  return <Terminal size={size} className="text-[#ea580c]" />;
}

class CommunityErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Community Error Caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-[#1f1813] border border-orange-200 dark:border-orange-900/50 rounded-2xl p-6 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] flex items-center justify-center mx-auto text-xl">
            💬
          </div>
          <h3 className="font-bold text-sm text-[#1c130d] dark:text-white">Community feed temporarily refreshing</h3>
          <p className="text-xs text-[#8d7565] dark:text-[#a89080] max-w-md mx-auto">
            {this.state.error?.message || 'Recovering feed stream...'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:brightness-105 cursor-pointer shadow-xs"
          >
            Refresh Feed
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CommunitiesPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab State: 'workspace' (Feed) | 'explore' (Directory) | 'my-guilds' (Joined) | 'leaderboard' (Rankings)
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'workspace');
  const [selectedGuildId, setSelectedGuildId] = useState(() => searchParams.get('community') || searchParams.get('guild') || '');

  const [dbCommunities, setDbCommunities] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [userRoles, setUserRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'active' | 'name'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [joiningId, setJoiningId] = useState(null);

  // Search & filter
  const [guildSearch, setGuildSearch] = useState('');
  const [guildCategoryFilter, setGuildCategoryFilter] = useState('all');

  // Create Community Modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Security',
    icon: '🛡️',
    tags: 'Web, OpenSource',
    is_private: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit Community Modal (Admin Only)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: 'Security',
    icon: '🛡️',
    tags: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Sync tab change with URL search params
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  // Sync selected community with URL search params
  const handleSelectGuild = (guildId) => {
    setSelectedGuildId(guildId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('community', guildId);
      next.delete('guild');
      return next;
    });
  };

  // Load communities & memberships
  useEffect(() => {
    fetchData();
  }, [session?.user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch live communities from Supabase with creator profiles
      const { data: comms, error: commsErr } = await supabase
        .from('communities')
        .select('*, profiles:creator_id(id, username, avatar_url, bio)')
        .order('created_at', { ascending: false });

      if (comms && !commsErr) {
        setDbCommunities(comms);

        // Auto-seed core technical guilds to live PostgreSQL if only 1 community exists
        if (session?.user?.id && comms.length <= 1) {
          const coreGuilds = [
            {
              creator_id: session.user.id,
              name: 'Zero-Trust Security & DevSecOps',
              slug: 'zero-trust-sec',
              category: 'Security',
              icon: '🛡️',
              banner_url:
                'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
              description:
                'The premier hub for vulnerability triage, automated CWE mitigation, AST fuzzing, static analysis, and zero-trust secrets scanning pipelines.',
              tags: ['DevSecOps', 'Zero-Trust', 'CWE-Audit', 'Rust', 'eBPF'],
              member_count: 42,
              is_private: false,
            },
            {
              creator_id: session.user.id,
              name: 'Autonomous AI & Multi-Agent Labs',
              slug: 'ai-agents-lab',
              category: 'AI & ML',
              icon: '🤖',
              banner_url:
                'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
              description:
                'Architecting next-gen agentic workflows with Groq Llama 3.3, LangChain, vector retrieval (RAG), tool calling, and local small language models.',
              tags: ['Llama-3.3', 'Groq', 'LangGraph', 'PyTorch', 'RAG'],
              member_count: 67,
              is_private: false,
            },
            {
              creator_id: session.user.id,
              name: 'Rust Core & Systems Engineering',
              slug: 'rust-systems',
              category: 'Systems',
              icon: '⚡',
              banner_url:
                'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
              description:
                'High-performance systems programming, WebAssembly micro-engines, memory safety without GC, async concurrency with Tokio, and Linux kernel hacking.',
              tags: ['Rust', 'Wasm', 'Tokio', 'Memory-Safety', 'Linux'],
              member_count: 31,
              is_private: false,
            },
          ];

          for (const g of coreGuilds) {
            if (!comms.some((c) => c.slug === g.slug || c.name === g.name)) {
              await supabase.from('communities').insert(g);
            }
          }

          const { data: updatedComms } = await supabase
            .from('communities')
            .select('*, profiles:creator_id(id, username, avatar_url, bio)')
            .order('created_at', { ascending: false });

          if (updatedComms) setDbCommunities(updatedComms);
        }
      }

      // 2. Fetch live memberships from Supabase
      const joinedSet = new Set();
      const rolesMap = {};
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id, user_id, role');

      if (memberships && session?.user?.id) {
        memberships
          .filter((m) => m.user_id === session.user.id)
          .forEach((m) => {
            joinedSet.add(m.community_id);
            rolesMap[m.community_id] = m.role || 'member';
          });
      }

      // Fallback local cache if offline
      if (joinedSet.size === 0) {
        const localJoined = JSON.parse(localStorage.getItem('connectra_joined_communities') || '[]');
        localJoined.forEach((id) => joinedSet.add(id));
      }

      setJoined(joinedSet);
      setUserRoles(rolesMap);
    } catch (err) {
      console.warn('Communities fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge Curated Guilds + Database Communities (preferring database records)
  const allCommunities = useMemo(() => {
    const list = [];
    const seenSlugs = new Set();

    // 1. Add database communities first
    dbCommunities.forEach((dbC) => {
      const slug = dbC.slug || dbC.name.toLowerCase().replace(/\s+/g, '-');
      seenSlugs.add(slug);
      seenSlugs.add(dbC.id);

      list.push({
        id: dbC.id,
        name: dbC.name,
        slug,
        category: dbC.category || 'Security',
        icon: dbC.icon || '🛡️',
        banner_url:
          dbC.banner_url ||
          'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
        description: dbC.description || 'Developer community on Connectra.',
        tags: Array.isArray(dbC.tags) ? dbC.tags : ['General', 'Development'],
        member_count: dbC.member_count || 1,
        is_private: !!dbC.is_private,
        is_verified: true,
        active_now: dbC.member_count || 1,
        creator: dbC.profiles || {
          username: 'community_member',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
          bio: 'Community Member',
        },
        rules: [
          'Be respectful, helpful, and constructive in all discussions.',
          'Share relevant code snippets, solutions, and questions.',
          'No credentials, unverified exploits, or spam links.',
        ],
        resources: [
          { title: 'Community Guidelines', type: 'Doc', url: 'https://connectra.dev' },
        ],
        created_at: dbC.created_at,
        is_database: true,
      });
    });

    // 2. Add curated templates for any not yet created in the database
    CURATED_COMMUNITIES.forEach((c) => {
      if (!seenSlugs.has(c.slug) && !seenSlugs.has(c.id)) {
        list.push(c);
      }
    });

    return list;
  }, [dbCommunities]);

  // Set default selected community once communities load
  useEffect(() => {
    if (!selectedGuildId && allCommunities.length > 0) {
      setSelectedGuildId(allCommunities[0].id);
    }
  }, [allCommunities, selectedGuildId]);

  // The active selected community in feed
  const activeGuild = useMemo(() => {
    if (selectedGuildId === 'all') return null;
    if (!allCommunities || allCommunities.length === 0) return null;
    return (
      allCommunities.find(
        (c) =>
          c.id === selectedGuildId ||
          c.slug === selectedGuildId ||
          (c.slug === 'zero-trust-sec' && (selectedGuildId === 'guild-zerotrust-sec' || selectedGuildId === '00000000-0000-4000-a000-000000000001')) ||
          (c.slug === 'ai-agents-lab' && (selectedGuildId === 'guild-ai-agents' || selectedGuildId === '00000000-0000-4000-a000-000000000002'))
      ) || allCommunities[0]
    );
  }, [allCommunities, selectedGuildId]);

  // Joined communities list
  const myJoinedGuilds = useMemo(() => {
    return allCommunities.filter((c) => joined.has(c.id));
  }, [allCommunities, joined]);

  // Current user access & role in active community
  const isCurrentJoined = useMemo(() => {
    if (!activeGuild) return false;
    return (
      joined.has(activeGuild.id) ||
      joined.has(activeGuild.slug) ||
      (activeGuild.slug === 'zero-trust-sec' && (joined.has('guild-zerotrust-sec') || joined.has('00000000-0000-4000-a000-000000000001'))) ||
      (activeGuild.slug === 'ai-agents-lab' && (joined.has('guild-ai-agents') || joined.has('00000000-0000-4000-a000-000000000002')))
    );
  }, [activeGuild, joined]);

  const isCurrentAdmin = useMemo(() => {
    if (!session?.user?.id || !activeGuild) return false;
    const role = userRoles[activeGuild.id] || userRoles[activeGuild.slug];
    const isOwnerByRole = role === 'owner' || role === 'admin' || role === 'moderator';
    const isOwnerByCreator = activeGuild.creator_id === session.user.id || activeGuild.creator?.id === session.user.id;
    return isOwnerByRole || isOwnerByCreator;
  }, [session?.user?.id, activeGuild, userRoles]);

  // Admin Actions: Edit Community
  const handleOpenEdit = (comm) => {
    if (!comm) return;
    setEditForm({
      name: comm.name || '',
      description: comm.description || '',
      category: comm.category || 'Security',
      icon: comm.icon || '🛡️',
      tags: Array.isArray(comm.tags) ? comm.tags.join(', ') : (comm.tags || ''),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!activeGuild) return;
    setSavingEdit(true);
    try {
      const tagArray = editForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const updateObj = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
        icon: editForm.icon,
        tags: tagArray.length > 0 ? tagArray : ['Development'],
      };

      if (activeGuild.is_database) {
        const { error } = await supabase
          .from('communities')
          .update(updateObj)
          .eq('id', activeGuild.id);

        if (error) throw error;
      }

      setDbCommunities((prev) =>
        prev.map((c) => (c.id === activeGuild.id ? { ...c, ...updateObj } : c))
      );

      toast.success('Community details updated! ✨');
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update community: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCommunity = async (comm) => {
    if (!confirm(`Are you sure you want to permanently delete "${comm.name}" and all of its posts? This cannot be undone.`)) return;
    try {
      if (comm.is_database) {
        await supabase.from('posts').delete().eq('community_id', comm.id);
        await supabase.from('community_members').delete().eq('community_id', comm.id);
        const { error } = await supabase.from('communities').delete().eq('id', comm.id);
        if (error) throw error;
      }

      toast.success(`Community "${comm.name}" deleted.`);
      setDbCommunities((prev) => prev.filter((c) => c.id !== comm.id));
      setSelectedGuildId('all');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete community: ' + err.message);
    }
  };

  // Handle Join / Leave (100% Supabase Backend Connected)
  const toggleJoin = async (community, e) => {
    if (e) e.stopPropagation();
    if (!session?.user?.id) {
      toast.error('Please sign in to join communities');
      return;
    }

    const isJoined = joined.has(community.id);
    const newJoined = new Set(joined);
    setJoiningId(community.id);

    try {
      if (isJoined) {
        newJoined.delete(community.id);
        setJoined(newJoined);
        localStorage.setItem('connectra_joined_communities', JSON.stringify([...newJoined]));

        // Direct Supabase community_members delete
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', community.id)
          .eq('user_id', session.user.id);

        setUserRoles((prev) => {
          const n = { ...prev };
          delete n[community.id];
          return n;
        });

        // Update database member_count if real DB record
        if (community.is_database) {
          await supabase
            .from('communities')
            .update({ member_count: Math.max(0, (community.member_count || 1) - 1) })
            .eq('id', community.id);
        }

        toast.success(`Left ${community.name}`);
      } else {
        newJoined.add(community.id);
        setJoined(newJoined);
        localStorage.setItem('connectra_joined_communities', JSON.stringify([...newJoined]));

        // Direct Supabase community_members insert
        const { error: joinErr } = await supabase
          .from('community_members')
          .insert({
            community_id: community.id,
            user_id: session.user.id,
            role: 'member',
          });

        if (joinErr && !joinErr.message.includes('unique')) {
          console.warn('Membership insert notice:', joinErr.message);
        }

        setUserRoles((prev) => ({
          ...prev,
          [community.id]: 'member',
        }));

        // Update database member_count if real DB record
        if (community.is_database) {
          await supabase
            .from('communities')
            .update({ member_count: (community.member_count || 0) + 1 })
            .eq('id', community.id);
        }

        toast.success(`Welcome to ${community.name}! Joined in database. 🎉`);
      }
    } catch (err) {
      console.warn('Membership error:', err);
      toast.error('Failed to update membership in database: ' + err.message);
    } finally {
      setJoiningId(null);
    }
  };

  // Handle Create Community
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Community name is required');
      return;
    }

    const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tagArray = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const newCommObj = {
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        category: form.category || 'Security',
        icon: form.icon || '🛡️',
        tags: tagArray.length > 0 ? tagArray : ['DevSecOps', 'OpenSource'],
        is_private: form.is_private,
        member_count: 1,
        creator_id: session?.user?.id || null,
      };

      let createdData = null;

      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('communities')
          .insert(newCommObj)
          .select()
          .single();

        if (error) {
          if (error.message.includes('unique')) {
            toast.error('A community with this name already exists. Please choose another.');
            setSubmitting(false);
            return;
          }
          console.warn('Supabase community insert warning:', error);
        } else {
          createdData = data;
          await supabase.from('community_members').insert({
            community_id: data.id,
            user_id: session.user.id,
            role: 'owner',
          });
        }
      }

      const finalComm = createdData || {
        ...newCommObj,
        id: 'user-comm-' + Date.now(),
        active_now: 1,
        created_at: new Date().toISOString(),
      };

      setDbCommunities((prev) => [finalComm, ...prev]);
      setJoined((prev) => {
        const s = new Set(prev);
        s.add(finalComm.id);
        localStorage.setItem('connectra_joined_communities', JSON.stringify([...s]));
        return s;
      });
      window.dispatchEvent(new Event('refreshCommunities'));

      setShowForm(false);
      setForm({
        name: '',
        description: '',
        category: 'Security',
        icon: '🛡️',
        tags: 'ZeroTrust, OpenSource',
        is_private: false,
      });

      toast.success('Community created successfully!');
      setSelectedGuildId(finalComm.id);
      setActiveTab('workspace');
    } catch (err) {
      toast.error('Failed to create community: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Sort Logic for Explore Tab
  const filteredCommunities = useMemo(() => {
    let result = allCommunities.filter((c) => {
      if (selectedCategory === 'joined') {
        if (!joined.has(c.id)) return false;
      } else if (selectedCategory !== 'all') {
        if (c.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesTags = (c.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'active') return (b.active_now || 0) - (a.active_now || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b.member_count || 0) - (a.member_count || 0);
    });

    return result;
  }, [allCommunities, selectedCategory, search, sortBy, joined]);

  // Featured Guild (Spotlight)
  const featuredGuild = allCommunities[0];

  // Copy Guild Link
  const handleShare = (comm, e) => {
    if (e) e.stopPropagation();
    const url = `${window.location.origin}/communities/${comm.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success(`Copied link to ${comm.name}!`);
    } else {
      toast.info(`Community link: ${url}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6f0] dark:bg-[#150f0c] text-[#1c130d] dark:text-[#faf6f0]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-44 rounded-3xl bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] dark:bg-[#150f0c] text-[#1c130d] dark:text-[#faf6f0] transition-colors duration-200 pb-20">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* =========================================================================
            1. COMMUNITY PANEL HERO BANNER
            ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#fffcf7] via-white to-[#fff4e6] dark:from-[#1f1813] dark:via-[#1a1410] dark:to-[#2b1f17] border border-[#f1e4d3] dark:border-[#3d2e24] shadow-md shadow-orange-500/5"
        >
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                <Users size={14} strokeWidth={2.5} />
                <span>Developer Communities</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1c130d] dark:text-white">
                Communities
              </h1>
              <p className="text-xs sm:text-sm text-[#6b5546] dark:text-[#c4aba0] leading-relaxed">
                Join developer communities, share technical knowledge, ask questions, and collaborate with peers.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs">
                  <Layers size={13} className="text-[#ea580c]" />
                  <strong className="font-bold text-[#1c130d] dark:text-white">{allCommunities.length}</strong>
                  <span className="text-[#8d7565] dark:text-[#a89080]">Communities</span>
                </span>

                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <strong className="font-bold text-[#1c130d] dark:text-white">{joined.size}</strong>
                  <span className="text-[#8d7565] dark:text-[#a89080]">Joined</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <button
                onClick={() => setShowForm(true)}
                className="px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] hover:brightness-105 flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all cursor-pointer active:scale-98"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Create Community</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* =========================================================================
            2. PANEL MODE TABS
            ========================================================================= */}
        <div className="flex items-center gap-2 border-b border-[#f1e4d3] dark:border-[#33261d] pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleTabChange('workspace')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-md shadow-orange-500/20'
                : 'bg-white dark:bg-[#1f1813] text-[#8d7565] dark:text-[#a89080] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
            }`}
          >
            <MessageSquare size={16} />
            <span>Discussions & Feed</span>
          </button>

          <button
            onClick={() => handleTabChange('explore')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'explore'
                ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-md shadow-orange-500/20'
                : 'bg-white dark:bg-[#1f1813] text-[#8d7565] dark:text-[#a89080] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
            }`}
          >
            <Globe size={16} />
            <span>Explore All ({allCommunities.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('my-guilds')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'my-guilds'
                ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-md shadow-orange-500/20'
                : 'bg-white dark:bg-[#1f1813] text-[#8d7565] dark:text-[#a89080] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
            }`}
          >
            <ShieldCheck size={16} />
            <span>My Communities ({joined.size})</span>
          </button>

          <button
            onClick={() => handleTabChange('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-md shadow-orange-500/20'
                : 'bg-white dark:bg-[#1f1813] text-[#8d7565] dark:text-[#a89080] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
            }`}
          >
            <Award size={16} />
            <span>Leaderboard</span>
          </button>
        </div>

        {/* =========================================================================
            3. TAB 1: COMMUNITY DISCUSSIONS & FEED
            ========================================================================= */}
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: COMMUNITIES SWITCHER (3 COLS) */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-3.5 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1c130d] dark:text-white flex items-center gap-1.5">
                    <Terminal size={14} className="text-[#ea580c]" />
                    <span>Communities</span>
                  </h3>
                  <span className="text-[10px] text-[#8d7565] font-mono">
                    {allCommunities.length} total
                  </span>
                </div>

                {/* Filter input */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565]" />
                  <input
                    type="text"
                    placeholder="Search communities..."
                    value={guildSearch}
                    onChange={(e) => setGuildSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                {/* Category Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {['all', 'Security', 'AI & ML', 'Systems', 'Web'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setGuildCategoryFilter(cat)}
                      className={`px-2 py-0.8 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                        guildCategoryFilter === cat
                          ? 'bg-[#ea580c] text-white shadow-2xs'
                          : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>

                {/* All Communities Unified Stream Option */}
                <button
                  onClick={() => handleSelectGuild('all')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    selectedGuildId === 'all'
                      ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs'
                      : 'text-[#6b5546] dark:text-[#a89080] hover:bg-[#fff7ed] dark:hover:bg-[#281f18] hover:text-[#1c130d] dark:hover:text-white'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-sm shrink-0">
                    🔥
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">All Communities Stream</div>
                    <div className="text-[10px] opacity-80 font-normal">Everything combined</div>
                  </div>
                </button>

                <div className="h-px bg-[#f1e4d3] dark:bg-[#33261d] my-1" />

                {/* Communities List */}
                <div className="flex flex-col gap-1 max-h-[520px] overflow-y-auto no-scrollbar pr-0.5">
                  {allCommunities
                    .filter((c) => {
                      const matchesSearch = guildSearch
                        ? c.name.toLowerCase().includes(guildSearch.toLowerCase()) ||
                          c.tags?.some((t) => t.toLowerCase().includes(guildSearch.toLowerCase()))
                        : true;
                      const matchesCategory =
                        guildCategoryFilter === 'all' ? true : c.category === guildCategoryFilter;
                      return matchesSearch && matchesCategory;
                    })
                    .map((comm) => {
                      const isSelected = selectedGuildId === comm.id || selectedGuildId === comm.slug;
                      const isUserJoined = joined.has(comm.id);

                      return (
                        <button
                          key={comm.id}
                          onClick={() => handleSelectGuild(comm.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                            isSelected
                              ? 'bg-orange-100/80 dark:bg-[#2e231b] border border-orange-300 dark:border-orange-800 text-[#ea580c] font-bold shadow-2xs'
                              : 'hover:bg-[#faf6f0] dark:hover:bg-[#281f18] text-[#6b5546] dark:text-[#a89080]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[#fff7ed] dark:bg-[#281f18] border border-[#fed7aa] dark:border-[#382b22] flex items-center justify-center shrink-0">
                              {renderTechIcon(comm, 14)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs group-hover:text-[#1c130d] dark:group-hover:text-white font-semibold">
                                {comm.name}
                              </div>
                              <div className="text-[10px] text-[#8d7565] dark:text-[#a89080]">
                                <span>{comm.member_count || 1} members</span>
                              </div>
                            </div>
                          </div>

                          {isUserJoined && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                              Joined
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: LIVE FEED & DISCUSSIONS STREAM (6 COLS) */}
            <div className="lg:col-span-6 space-y-4">
              {/* Header for the current community */}
              <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-orange-500/5 dark:bg-[#281f18] border border-orange-200/80 dark:border-[#423124] flex items-center justify-center shrink-0 shadow-2xs">
                    {activeGuild ? renderTechIcon(activeGuild, 22) : <Flame size={22} className="text-[#ea580c]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black text-[#1c130d] dark:text-white truncate">
                        {activeGuild ? activeGuild.name : 'All Communities Stream'}
                      </h2>
                      {activeGuild?.is_verified && (
                        <ShieldCheck size={14} className="text-blue-500 shrink-0" fill="currentColor" />
                      )}
                      {activeGuild?.category && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22]">
                          {activeGuild.category}
                        </span>
                      )}
                      {isCurrentAdmin && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <Shield size={10} /> Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8d7565] dark:text-[#a89080] truncate mt-0.5">
                      {activeGuild
                        ? activeGuild.description
                        : 'Discussions and updates from across all communities.'}
                    </p>
                  </div>
                </div>

                {activeGuild && (
                  <button
                    onClick={(e) => toggleJoin(activeGuild, e)}
                    disabled={joiningId === activeGuild.id}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 ${
                      joined.has(activeGuild.id)
                        ? 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22] hover:text-rose-600'
                        : 'bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] text-white hover:brightness-105 shadow-md shadow-orange-500/20'
                    }`}
                  >
                    {joined.has(activeGuild.id) ? (
                      <>
                        <Check size={12} className="text-emerald-500" />
                        <span>Joined</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Join</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Discussion Feed */}
              {selectedGuildId === 'all' ? (
                <Feed
                  session={session}
                  placeholder="Post to all communities..."
                />
              ) : (
                <CommunityErrorBoundary key={activeGuild?.id || selectedGuildId}>
                  <CommunityFeed
                    session={session}
                    community={activeGuild}
                    communityId={activeGuild?.id || selectedGuildId}
                    isJoined={isCurrentJoined}
                    isAdmin={isCurrentAdmin}
                    onToggleJoin={(e) => toggleJoin(activeGuild, e)}
                    onCommunityUpdated={fetchData}
                  />
                </CommunityErrorBoundary>
              )}
            </div>

            {/* RIGHT COLUMN: ABOUT COMMUNITY SIDEBAR (3 COLS) */}
            <div className="lg:col-span-3 space-y-4">
              {activeGuild ? (
                <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl overflow-hidden shadow-xs space-y-4">
                  {/* Clean SaaS Workspace Header */}
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent dark:from-orange-500/15 dark:via-[#1f1813] dark:to-[#1f1813] border-b border-[#f1e4d3] dark:border-[#382b22] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] shadow-2xs flex items-center justify-center shrink-0">
                        {renderTechIcon(activeGuild, 24)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-[#ea580c] dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60">
                          {activeGuild.category || 'Tech'}
                        </span>
                        <button
                          onClick={(e) => handleShare(activeGuild, e)}
                          title="Share Community"
                          className="p-1.5 rounded-xl border border-[#f1e4d3] dark:border-[#382b22] bg-white dark:bg-[#281f18] hover:text-[#ea580c] text-[#8d7565] transition-colors cursor-pointer shadow-2xs"
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-black text-sm text-[#1c130d] dark:text-white leading-tight">
                          {activeGuild.name}
                        </h3>
                        {activeGuild.is_verified && (
                          <ShieldCheck size={13} className="text-blue-500 shrink-0" fill="currentColor" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#8d7565] font-mono">
                        <span>@{activeGuild.slug}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-sans">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {activeGuild.member_count || 1} Members
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info Body */}
                  <div className="p-4 pt-0 space-y-3.5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8d7565] mb-1">
                        About Community
                      </h4>
                      <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] leading-relaxed">
                        {activeGuild.description || 'Community for technical discussions and sharing.'}
                      </p>
                    </div>

                    {/* Tags */}
                    {activeGuild.tags && activeGuild.tags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#8d7565] mb-1.5">
                          Topics
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {activeGuild.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Community Rules */}
                    {activeGuild.rules && activeGuild.rules.length > 0 && (
                      <div className="pt-2 border-t border-[#f1e4d3] dark:border-[#33261d]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] mb-1.5 flex items-center gap-1">
                          <Shield size={12} />
                          <span>Community Rules</span>
                        </h4>
                        <ul className="space-y-1 text-[11px] text-[#6b5546] dark:text-[#c4aba0]">
                          {activeGuild.rules.slice(0, 3).map((rule, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-[#ea580c] font-bold">•</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Admin Management Controls */}
                    {isCurrentAdmin && (
                      <div className="pt-2 border-t border-[#f1e4d3] dark:border-[#33261d] space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Shield size={13} />
                          <span>Admin Management</span>
                        </div>
                        <p className="text-[11px] text-[#8d7565]">
                          You manage this community. You can edit community info or delete posts.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleOpenEdit(activeGuild)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100/70 transition-all cursor-pointer text-center"
                          >
                            Edit Community
                          </button>
                          <button
                            onClick={() => handleDeleteCommunity(activeGuild)}
                            className="py-1.5 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100/60 transition-all cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="pt-2">
                      <Link
                        to={`/communities/${activeGuild.id}`}
                        className="w-full py-2 px-3 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#ea580c] hover:bg-orange-50 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <span>View Community Details</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-4 shadow-xs text-center space-y-2">
                  <Flame size={24} className="mx-auto text-[#ea580c]" />
                  <h4 className="text-xs font-bold text-[#1c130d] dark:text-white">All Communities Stream</h4>
                  <p className="text-xs text-[#8d7565] leading-relaxed">
                    Select a community on the left to view its discussions, rules, and members.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            4. TAB 2: EXPLORE ALL GUILDS (CATALOG & DIRECTORY)
            ========================================================================= */}
        {activeTab === 'explore' && (
          <div className="space-y-6">
            {/* Spotlight Banner */}
            {featuredGuild && selectedCategory === 'all' && !search && (
              <motion.div
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-3xl p-6 sm:p-7 overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-white to-white dark:via-[#1f1813] dark:to-[#1a1410] shadow-sm group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white dark:bg-[#281f18] border-2 border-emerald-500/30 flex items-center justify-center text-4xl shadow-sm shrink-0">
                      {featuredGuild.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <Flame size={12} /> Featured Community
                        </span>
                        <span className="text-xs text-[#8d7565] flex items-center gap-1">
                          <Activity size={12} className="text-emerald-500 animate-pulse" />{' '}
                          {featuredGuild.member_count || 1} members
                        </span>
                      </div>
                      <Link to={`/communities/${featuredGuild.id}`}>
                        <h2 className="text-lg sm:text-xl font-black text-[#1c130d] dark:text-white group-hover:text-[#ea580c] transition-colors">
                          {featuredGuild.name}
                        </h2>
                      </Link>
                      <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] max-w-2xl line-clamp-2">
                        {featuredGuild.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                    <button
                      onClick={(e) => toggleJoin(featuredGuild, e)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        joined.has(featuredGuild.id)
                          ? 'bg-white dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22] hover:text-rose-600'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {joined.has(featuredGuild.id) ? (
                        <>
                          <Check size={14} /> Joined
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Join
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedGuildId(featuredGuild.id);
                        setActiveTab('workspace');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ea580c] text-white hover:brightness-105 flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <span>View Discussions</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Search, Sort & Filters Bar */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8d7565]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by community name, #tag, or topic (e.g. Security, AI, Python, Rust)..."
                    className="w-full bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl pl-10 pr-9 py-2.5 text-xs text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c] transition-all shadow-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8d7565] hover:text-[#1c130d] p-1 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Sort & View Mode */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-xl px-3 py-2 text-xs font-bold text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] cursor-pointer"
                  >
                    <option value="popular">Most Members</option>
                    <option value="active">Most Active</option>
                    <option value="name">Alphabetical</option>
                  </select>

                  <div className="flex items-center bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-[#ea580c] text-white shadow-xs'
                          : 'text-[#8d7565] hover:text-[#1c130d]'
                      }`}
                      title="Grid View"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-[#ea580c] text-white shadow-xs'
                          : 'text-[#8d7565] hover:text-[#1c130d]'
                      }`}
                      title="List View"
                    >
                      <List size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Categories Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {COMMUNITY_CATEGORIES.map((cat) => {
                  const isCatActive = selectedCategory === cat.id;
                  const count =
                    cat.id === 'all'
                      ? allCommunities.length
                      : cat.id === 'joined'
                      ? joined.size
                      : allCommunities.filter(
                          (c) => c.category?.toLowerCase() === cat.id.toLowerCase()
                        ).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isCatActive
                          ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white shadow-xs'
                          : 'bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] text-[#6b5546] dark:text-[#a89080] hover:text-[#1c130d]'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isCatActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guilds Grid or List */}
            {filteredCommunities.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-8 space-y-3">
                <Compass size={48} className="mx-auto text-[#8d7565]/40" />
                <h3 className="text-base font-bold text-[#1c130d] dark:text-white">No communities found</h3>
                <p className="text-xs text-[#8d7565] max-w-sm mx-auto leading-relaxed">
                  We couldn't find any communities matching "{search || selectedCategory}".
                </p>
                <button
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ea580c] text-white cursor-pointer hover:brightness-105 shadow-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCommunities.map((community, i) => {
                  const isJoined = joined.has(community.id);

                  return (
                    <motion.div
                      key={community.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 flex flex-col justify-between hover:border-[#ea580c]/50 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      {/* Top Accent Bar */}
                      <div
                        className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${
                          community.gradient || 'from-[#ea580c] to-[#fb923c]'
                        }`}
                      />

                      <div>
                        {/* Header: Icon & Badges */}
                        <div className="flex items-start justify-between mb-3 pt-1">
                          <div className="w-12 h-12 rounded-2xl bg-[#fff7ed] dark:bg-[#281f18] border border-[#fed7aa] dark:border-[#423124] flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                            {community.icon || '🛡️'}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {community.is_private ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <Lock size={10} /> Private
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                <Globe size={10} /> Public
                              </span>
                            )}

                            {community.is_verified && (
                              <span title="Verified Hub">
                                <Shield size={13} className="text-blue-500" fill="currentColor" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <Link to={`/communities/${community.id}`}>
                          <h3 className="font-bold text-sm sm:text-base text-[#1c130d] dark:text-white group-hover:text-[#ea580c] transition-colors line-clamp-1 mb-1">
                            {community.name}
                          </h3>
                        </Link>

                        {/* Description */}
                        <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] line-clamp-2 leading-relaxed mb-3">
                          {community.description}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {(community.tags || []).slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Bar: Counts & Action */}
                      <div className="pt-3 border-t border-[#f1e4d3] dark:border-[#33261d] flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#1c130d] dark:text-white flex items-center gap-1">
                            <Users size={12} className="text-[#ea580c]" />
                            <span>{(community.member_count || 1).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{community.active_now || 3} online</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedGuildId(community.id);
                              setActiveTab('workspace');
                            }}
                            className="p-1.5 text-[#8d7565] hover:text-[#ea580c] rounded-lg transition-colors cursor-pointer"
                            title="View Community"
                          >
                            <Terminal size={15} />
                          </button>

                          <button
                            onClick={(e) => toggleJoin(community, e)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              isJoined
                                ? 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border-[#f1e4d3] dark:border-[#382b22] hover:text-rose-600'
                                : 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white border-transparent hover:brightness-105 shadow-2xs'
                            }`}
                          >
                            {isJoined ? 'Joined' : 'Join'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCommunities.map((community, i) => {
                  const isJoined = joined.has(community.id);

                  return (
                    <motion.div
                      key={community.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#ea580c]/50 transition-all shadow-xs group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#fff7ed] dark:bg-[#281f18] border border-[#fed7aa] dark:border-[#423124] flex items-center justify-center text-xl shrink-0">
                          {community.icon || '🛡️'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/communities/${community.id}`}>
                              <h3 className="font-bold text-sm text-[#1c130d] dark:text-white group-hover:text-[#ea580c] transition-colors truncate">
                                {community.name}
                              </h3>
                            </Link>
                            {community.is_verified && (
                              <Shield size={12} className="text-blue-500 shrink-0" fill="currentColor" />
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565]">
                              {community.category || 'Community'}
                            </span>
                          </div>
                          <p className="text-xs text-[#6b5546] dark:text-[#a89080] truncate max-w-xl mt-0.5">
                            {community.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f1e4d3] dark:border-[#33261d]">
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#1c130d] dark:text-white flex items-center gap-1 justify-end">
                            <Users size={12} className="text-[#ea580c]" />
                            <span>{(community.member_count || 1).toLocaleString()}</span>
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{community.member_count || 1} members</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedGuildId(community.id);
                              setActiveTab('workspace');
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#faf6f0] dark:bg-[#281f18] text-[#ea580c] hover:bg-orange-50 border border-[#f1e4d3] dark:border-[#382b22] cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => toggleJoin(community, e)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isJoined
                                ? 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22] hover:text-rose-600'
                                : 'bg-[#ea580c] text-white hover:brightness-105'
                            }`}
                          >
                            {isJoined ? 'Joined' : 'Join'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            5. TAB 3: MY GUILDS & MEMBERSHIPS MANAGEMENT
            ========================================================================= */}
        {activeTab === 'my-guilds' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#1c130d] dark:text-white">
                  My Communities
                </h2>
                <p className="text-xs text-[#8d7565]">
                  Communities you participate in or have joined
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ea580c] text-white hover:brightness-105 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={14} /> Create Community
              </button>
            </div>

            {myJoinedGuilds.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-8 space-y-3">
                <ShieldCheck size={48} className="mx-auto text-[#8d7565]/40" />
                <h3 className="text-base font-bold text-[#1c130d] dark:text-white">
                  No joined communities yet
                </h3>
                <p className="text-xs text-[#8d7565] max-w-sm mx-auto leading-relaxed">
                  Join developer communities to participate in technical discussions, ask questions, and collaborate with peers.
                </p>
                <button
                  onClick={() => setActiveTab('explore')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ea580c] text-white cursor-pointer hover:brightness-105 shadow-xs"
                >
                  Explore Communities
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myJoinedGuilds.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 flex flex-col justify-between shadow-xs space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#fff7ed] dark:bg-[#281f18] border border-[#fed7aa] dark:border-[#423124] flex items-center justify-center text-2xl shadow-2xs">
                          {comm.icon || '🛡️'}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Verified Member
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#1c130d] dark:text-white mb-1">
                        {comm.name}
                      </h3>
                      <p className="text-xs text-[#6b5546] dark:text-[#a89080] line-clamp-2 leading-relaxed">
                        {comm.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#f1e4d3] dark:border-[#33261d] flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedGuildId(comm.id);
                          setActiveTab('workspace');
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-[#ea580c] text-white hover:brightness-105 text-xs font-bold text-center cursor-pointer shadow-2xs"
                      >
                        View Feed
                      </button>

                      <button
                        onClick={(e) => toggleJoin(comm, e)}
                        className="py-1.5 px-3 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:text-rose-600 text-xs font-bold cursor-pointer"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            6. TAB 4: LEADERBOARD & COMMUNITY DISCUSSIONS
            ========================================================================= */}
        {activeTab === 'leaderboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Community Rankings */}
            <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#33261d]">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-[#ea580c]" />
                  <h3 className="text-sm font-bold text-[#1c130d] dark:text-white">
                    Top Communities
                  </h3>
                </div>
                <span className="text-[11px] text-[#8d7565]">By Members</span>
              </div>

              <div className="space-y-3">
                {[...allCommunities]
                  .sort((a, b) => (b.member_count || 1) - (a.member_count || 1))
                  .slice(0, 6)
                  .map((comm, idx) => (
                    <div
                      key={comm.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-[#ea580c] font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-lg shrink-0">{comm.icon || '💬'}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#1c130d] dark:text-white truncate">
                            {comm.name}
                          </h4>
                          <span className="text-[10px] text-[#8d7565]">
                            {comm.category || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-[#ea580c]">
                          {(comm.member_count || 1).toLocaleString()} members
                        </span>
                        <div className="mt-1">
                          <button
                            onClick={() => {
                              setSelectedGuildId(comm.id);
                              setActiveTab('workspace');
                            }}
                            className="text-[10px] text-[#ea580c] hover:underline font-bold cursor-pointer"
                          >
                            Open Feed →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Community Events & Discussions */}
            <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#33261d]">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-[#ea580c]" />
                  <h3 className="text-sm font-bold text-[#1c130d] dark:text-white">
                    Community Events & Discussions
                  </h3>
                </div>
                <Link
                  to="/events"
                  className="text-xs font-bold text-[#ea580c] hover:underline"
                >
                  All Events →
                </Link>
              </div>

              <div className="p-8 text-center space-y-3 bg-[#faf6f0] dark:bg-[#281f18] rounded-2xl border border-[#f1e4d3] dark:border-[#382b22]">
                <Calendar size={36} className="mx-auto text-[#ea580c]" />
                <h4 className="text-sm font-bold text-[#1c130d] dark:text-white">
                  Developer Events & Meetups
                </h4>
                <p className="text-xs text-[#8d7565] max-w-sm mx-auto leading-relaxed">
                  Join hackathons, tech talks, and open discussions organized across our developer communities.
                </p>
                <div className="pt-2">
                  <Link
                    to="/events"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ea580c] text-white hover:brightness-105 shadow-xs"
                  >
                    <span>Browse Events Hub</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =========================================================================
          7. CREATE COMMUNITY MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6 overflow-y-auto cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowForm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl relative my-auto space-y-5 cursor-default"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#33261d]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[#ea580c]">
                    <Plus size={20} strokeWidth={2.8} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#1c130d] dark:text-white">
                      Create a Community
                    </h2>
                    <p className="text-xs text-[#8d7565]">Start a developer community on Connectra</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white rounded-xl hover:bg-[#faf6f0] dark:hover:bg-[#281f18] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Glyph Picker */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-2 block">
                    Community Icon
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, icon }))}
                        className={`text-xl p-2 rounded-xl transition-all border cursor-pointer ${
                          form.icon === icon
                            ? 'bg-orange-100 dark:bg-orange-950/60 border-[#ea580c] scale-110 shadow-xs'
                            : 'bg-[#faf6f0] dark:bg-[#281f18] border-[#f1e4d3] dark:border-[#382b22] hover:border-[#ea580c]/50'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                      Community Name *
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Python & FastAPI Developers"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full text-xs px-2.5 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] cursor-pointer font-semibold"
                    >
                      <option value="Security">Security</option>
                      <option value="AI & ML">AI & ML</option>
                      <option value="Systems">Systems</option>
                      <option value="Web">Web</option>
                      <option value="Creative">Creative</option>
                      <option value="Community">Founders</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                    Community Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe what this community is about and what members can share..."
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] resize-none"
                  />
                </div>

                {/* Tags and Privacy */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                      placeholder="Tags (e.g. Python, API, Backend)"
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs select-none px-3 py-2 bg-[#faf6f0] dark:bg-[#281f18] rounded-xl border border-[#f1e4d3] dark:border-[#382b22]">
                    <input
                      type="checkbox"
                      checked={form.is_private}
                      onChange={(e) => setForm((p) => ({ ...p, is_private: e.target.checked }))}
                      className="rounded text-[#ea580c] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080]">
                      Private Community
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] text-white font-black text-xs hover:brightness-105 transition-all shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Community...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Create Community</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          8. EDIT COMMUNITY MODAL (ADMIN ONLY)
          ========================================================================= */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6 overflow-y-auto cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEditModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl relative my-auto space-y-5 cursor-default"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#33261d]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Shield size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#1c130d] dark:text-white">
                      Edit Community Details
                    </h2>
                    <p className="text-xs text-[#8d7565]">Manage topics, description, and settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white rounded-xl hover:bg-[#faf6f0] dark:hover:bg-[#281f18] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Icon Picker */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-2 block">
                    Community Icon
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, icon }))}
                        className={`text-xl p-2 rounded-xl transition-all border cursor-pointer ${
                          editForm.icon === icon
                            ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 scale-110 shadow-xs'
                            : 'bg-[#faf6f0] dark:bg-[#281f18] border-[#f1e4d3] dark:border-[#382b22] hover:border-amber-500/50'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                      Community Name *
                    </label>
                    <input
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full text-xs px-2.5 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] cursor-pointer font-semibold"
                    >
                      <option value="Security">Security</option>
                      <option value="AI & ML">AI & ML</option>
                      <option value="Systems">Systems</option>
                      <option value="Web">Web</option>
                      <option value="Creative">Creative</option>
                      <option value="Community">Founders</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                    Community Description
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c] resize-none"
                  />
                </div>

                {/* Topics / Tags */}
                <div>
                  <label className="text-[11px] font-bold text-[#6b5546] dark:text-[#a89080] uppercase tracking-wider mb-1 block">
                    Topics / Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))}
                    placeholder="e.g. Llama-3.3, Groq, LangChain"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#f1e4d3] dark:border-[#382b22] text-xs font-bold text-[#8d7565] hover:text-[#1c130d] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] via-[#f97316] to-[#fb923c] text-white font-black text-xs hover:brightness-105 transition-all shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
