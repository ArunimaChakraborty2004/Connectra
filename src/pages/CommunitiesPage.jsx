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
  UserPlus,
  UserCheck,
  UserMinus,
  Settings,
  Trash2,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import CommunityFeed from '../components/community/CommunityFeed';
import Feed from '../components/Feed';

// Categories list with Lucide vector icons
const COMMUNITY_CATEGORIES = [
  { id: 'all', label: 'All Guilds', icon: Terminal },
  { id: 'Security', label: 'Security', icon: ShieldCheck },
  { id: 'AI & ML', label: 'AI & ML', icon: Bot },
  { id: 'Systems', label: 'Systems', icon: Cpu },
  { id: 'Cloud', label: 'Cloud & DevOps', icon: Boxes },
  { id: 'Web', label: 'Web Architecture', icon: Globe },
  { id: 'Data', label: 'Data & Async', icon: Database },
];

// SaaS Vector Icon Resolver for Communities
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
  if (slug.includes('cloud') || slug.includes('kube') || slug.includes('devops') || name.includes('cloud')) {
    return <Boxes size={size} className="text-cyan-600 dark:text-cyan-400" />;
  }
  if (slug.includes('web') || slug.includes('next') || slug.includes('react') || cat.includes('web')) {
    return <Globe size={size} className="text-blue-600 dark:text-blue-400" />;
  }
  if (slug.includes('python') || slug.includes('data') || cat.includes('data') || name.includes('python')) {
    return <Database size={size} className="text-amber-600 dark:text-amber-400" />;
  }
  if (slug.includes('red-team') || slug.includes('offensive')) {
    return <Lock size={size} className="text-rose-600 dark:text-rose-400" />;
  }
  return <Terminal size={size} className="text-[#ea580c]" />;
}

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
          <Terminal size={24} className="mx-auto text-[#ea580c]" />
          <h3 className="font-bold text-sm text-[#1c130d] dark:text-white">Community feed refreshing</h3>
          <p className="text-xs text-[#8d7565] dark:text-[#a89080] max-w-md mx-auto">
            {this.state.error?.message || 'Recovering feed stream...'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:brightness-105 cursor-pointer shadow-xs"
          >
            Refresh Stream
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

  // Navigation State
  const [selectedGuildId, setSelectedGuildId] = useState(() => searchParams.get('community') || searchParams.get('guild') || '');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('feed'); // 'feed' | 'members' | 'about' | 'settings'

  // Database Data
  const [dbCommunities, setDbCommunities] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [userRoles, setUserRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);

  // Left Rail Filter
  const [guildSearch, setGuildSearch] = useState('');
  const [guildCategoryFilter, setGuildCategoryFilter] = useState('all');
  const [railSegment, setRailSegment] = useState('all'); // 'all' | 'joined' | 'managed'
  const [guildSort, setGuildSort] = useState('popular'); // 'popular' | 'newest' | 'alphabetical'

  // Members Management State
  const [guildMembers, setGuildMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Invite / Add Member Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState('member');
  const [addingUserId, setAddingUserId] = useState(null);

  // Create Community Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: 'Security',
    tags: 'DevSecOps, ZeroTrust',
    is_private: false,
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Edit Community State (Admin)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: 'Security',
    tags: '',
    is_private: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Sync selected community with URL
  const handleSelectGuild = (guildId) => {
    setSelectedGuildId(guildId);
    setActiveWorkspaceTab('feed');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('community', guildId);
      next.delete('guild');
      return next;
    });
  };

  // 1. Fetch Communities & User Memberships from Database
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: comms, error: commsErr } = await supabase
        .from('communities')
        .select('*, profiles:creator_id(id, username, avatar_url, bio)')
        .order('created_at', { ascending: false });

      if (comms && !commsErr) {
        setDbCommunities(comms);
        if (!selectedGuildId && comms.length > 0) {
          setSelectedGuildId(comms[0].id);
        }
      }

      // Fetch memberships
      if (session?.user?.id) {
        const { data: memberships } = await supabase
          .from('community_members')
          .select('community_id, user_id, role')
          .eq('user_id', session.user.id);

        if (memberships) {
          const joinedSet = new Set();
          const rolesMap = {};
          memberships.forEach((m) => {
            joinedSet.add(m.community_id);
            rolesMap[m.community_id] = m.role || 'member';
          });
          setJoined(joinedSet);
          setUserRoles(rolesMap);
        }
      }
    } catch (err) {
      console.warn('Communities fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session?.user?.id]);

  // The active selected community
  const activeGuild = useMemo(() => {
    if (!dbCommunities || dbCommunities.length === 0) return null;
    return (
      dbCommunities.find(
        (c) => c.id === selectedGuildId || c.slug === selectedGuildId
      ) || dbCommunities[0]
    );
  }, [dbCommunities, selectedGuildId]);

  // Sync edit form with active guild
  useEffect(() => {
    if (activeGuild) {
      setEditForm({
        name: activeGuild.name || '',
        description: activeGuild.description || '',
        category: activeGuild.category || 'Security',
        tags: Array.isArray(activeGuild.tags) ? activeGuild.tags.join(', ') : (activeGuild.tags || ''),
        is_private: !!activeGuild.is_private,
      });
    }
  }, [activeGuild]);

  // Current user admin & join status
  const isCurrentJoined = useMemo(() => {
    if (!activeGuild) return false;
    return joined.has(activeGuild.id) || joined.has(activeGuild.slug);
  }, [activeGuild, joined]);

  const isCurrentAdmin = useMemo(() => {
    if (!session?.user?.id || !activeGuild) return false;
    const role = userRoles[activeGuild.id] || userRoles[activeGuild.slug];
    const isOwnerByRole = role === 'owner' || role === 'admin' || role === 'moderator';
    const isOwnerByCreator = activeGuild.creator_id === session.user.id || activeGuild.profiles?.id === session.user.id;
    return isOwnerByRole || isOwnerByCreator;
  }, [session?.user?.id, activeGuild, userRoles]);

  // 2. Fetch Members of Active Community from Database
  const loadMembers = async (commId) => {
    if (!commId) return;
    setLoadingMembers(true);
    try {
      const { data: membersData, error: memErr } = await supabase
        .from('community_members')
        .select('id, role, joined_at, user_id')
        .eq('community_id', commId)
        .order('joined_at', { ascending: false });

      if (membersData && !memErr) {
        const userIds = [...new Set(membersData.map((m) => m.user_id).filter(Boolean))];
        let profilesMap = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, bio, xp, level, tech_stack')
            .in('id', userIds);

          (profs || []).forEach((p) => {
            profilesMap[p.id] = p;
          });
        }

        const normalized = membersData.map((m) => ({
          ...m,
          profile: profilesMap[m.user_id] || {
            username: 'developer',
            full_name: 'Developer',
            avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
            xp: 0,
            level: 1,
          },
        }));

        setGuildMembers(normalized);
      } else {
        setGuildMembers([]);
      }
    } catch (err) {
      console.warn('Error loading community members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeGuild?.id && (activeWorkspaceTab === 'members' || activeWorkspaceTab === 'settings')) {
      loadMembers(activeGuild.id);
    }
  }, [activeGuild?.id, activeWorkspaceTab]);

  // 3. User Search in Invite Modal
  const handleSearchUsers = async (searchTerm) => {
    setUserSearchQuery(searchTerm);
    if (!searchTerm.trim()) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, tech_stack')
        .or(`username.ilike.%${searchTerm.trim()}%,full_name.ilike.%${searchTerm.trim()}%`)
        .limit(8);

      if (!error && users) {
        setUserSearchResults(users);
      }
    } catch (err) {
      console.warn('User search error:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // 4. Add / Invite Member Directly to Community
  const handleAddMember = async (targetUserId) => {
    if (!activeGuild) return;
    setAddingUserId(targetUserId);
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: activeGuild.id,
          user_id: targetUserId,
          role: selectedRoleToAssign,
        });

      if (error) {
        if (error.message?.includes('unique') || error.code === '23505') {
          toast.info('This developer is already a member of this community.');
          return;
        }
        if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Blocked by Supabase RLS: Run the updated Section 4 query in seed_communities.sql in your Supabase SQL Editor to allow admins to add members.');
          return;
        }
        throw error;
      }

      // Update database member_count safely
      try {
        await supabase
          .from('communities')
          .update({ member_count: (activeGuild.member_count || 0) + 1 })
          .eq('id', activeGuild.id);
      } catch (countErr) {
        console.warn('Member count increment notice:', countErr);
      }

      toast.success('Member successfully added to community.');
      await loadMembers(activeGuild.id);
      fetchData();
    } catch (err) {
      toast.error('Failed to add member: ' + err.message);
    } finally {
      setAddingUserId(null);
    }
  };

  // 5. Change Member Role (Admin Action)
  const handleChangeRole = async (memberId, newRole) => {
    try {
      const { error } = await supabase
        .from('community_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) {
        if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Blocked by Supabase RLS: Run Section 4 in seed_communities.sql in your Supabase SQL Editor.');
          return;
        }
        throw error;
      }
      toast.success(`Role updated to ${newRole}.`);
      setGuildMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      toast.error('Failed to update role: ' + err.message);
    }
  };

  // 6. Remove Member from Community (Admin Action)
  const handleRemoveMember = async (memberId, memberUserId) => {
    if (!confirm('Are you sure you want to remove this member from the community?')) return;
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Blocked by Supabase RLS: Run Section 4 in seed_communities.sql in your Supabase SQL Editor.');
          return;
        }
        throw error;
      }

      await supabase
        .from('communities')
        .update({ member_count: Math.max(0, (activeGuild.member_count || 1) - 1) })
        .eq('id', activeGuild.id);

      toast.success('Member removed from community.');
      setGuildMembers((prev) => prev.filter((m) => m.id !== memberId));
      fetchData();
    } catch (err) {
      toast.error('Failed to remove member: ' + err.message);
    }
  };

  // 7. Join / Leave Community
  const toggleJoin = async (community, e) => {
    if (e) e.stopPropagation();
    if (!session?.user?.id) {
      toast.error('Please sign in to join communities.');
      return;
    }

    const isJoined = joined.has(community.id);
    const newJoined = new Set(joined);
    setJoiningId(community.id);

    try {
      if (isJoined) {
        newJoined.delete(community.id);
        setJoined(newJoined);

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

        await supabase
          .from('communities')
          .update({ member_count: Math.max(0, (community.member_count || 1) - 1) })
          .eq('id', community.id);

        toast.success(`Left ${community.name}`);
      } else {
        newJoined.add(community.id);
        setJoined(newJoined);

        await supabase
          .from('community_members')
          .insert({
            community_id: community.id,
            user_id: session.user.id,
            role: 'member',
          });

        setUserRoles((prev) => ({
          ...prev,
          [community.id]: 'member',
        }));

        await supabase
          .from('communities')
          .update({ member_count: (community.member_count || 0) + 1 })
          .eq('id', community.id);

        toast.success(`Welcome to ${community.name}! Joined successfully.`);
      }
      fetchData();
    } catch (err) {
      toast.error('Failed to update membership: ' + err.message);
    } finally {
      setJoiningId(null);
    }
  };

  // 8. Create Community
  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error('Community name is required.');
      return;
    }

    const slug = createForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tagArray = createForm.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmittingCreate(true);
    try {
      const newCommObj = {
        name: createForm.name.trim(),
        slug,
        description: createForm.description.trim(),
        category: createForm.category || 'Security',
        tags: tagArray.length > 0 ? tagArray : ['Engineering', 'OpenSource'],
        is_private: createForm.is_private,
        member_count: 1,
        creator_id: session?.user?.id || null,
      };

      const { data, error } = await supabase
        .from('communities')
        .insert(newCommObj)
        .select()
        .single();

      if (error) {
        if (error.message.includes('unique')) {
          toast.error('A community with this name or slug already exists.');
          return;
        }
        throw error;
      }

      if (data && session?.user?.id) {
        await supabase.from('community_members').insert({
          community_id: data.id,
          user_id: session.user.id,
          role: 'owner',
        });
      }

      toast.success(`Community "${data.name}" created successfully.`);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        description: '',
        category: 'Security',
        tags: 'DevSecOps, ZeroTrust',
        is_private: false,
      });

      fetchData();
      handleSelectGuild(data.id);
    } catch (err) {
      toast.error('Failed to create community: ' + err.message);
    } finally {
      setSubmittingCreate(false);
    }
  };

  // 9. Save Community Edits (Admin)
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
        tags: tagArray.length > 0 ? tagArray : ['Development'],
        is_private: editForm.is_private,
      };

      const { error } = await supabase
        .from('communities')
        .update(updateObj)
        .eq('id', activeGuild.id);

      if (error) {
        if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Blocked by Supabase RLS: Run Section 4 in seed_communities.sql in your Supabase SQL Editor.');
          return;
        }
        throw error;
      }

      toast.success('Community settings saved successfully.');
      fetchData();
      setActiveWorkspaceTab('feed');
    } catch (err) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // 10. Delete Community (Admin)
  const handleDeleteCommunity = async () => {
    if (!activeGuild) return;
    if (!confirm(`Are you sure you want to permanently delete "${activeGuild.name}" and all of its posts? This action is irreversible.`)) return;
    try {
      await supabase.from('posts').delete().eq('community_id', activeGuild.id);
      await supabase.from('community_members').delete().eq('community_id', activeGuild.id);
      const { error } = await supabase.from('communities').delete().eq('id', activeGuild.id);
      if (error) {
        if (error.message?.includes('row-level security') || error.code === '42501') {
          toast.error('Blocked by Supabase RLS: Run Section 4 in seed_communities.sql in your Supabase SQL Editor.');
          return;
        }
        throw error;
      }

      toast.success(`Community "${activeGuild.name}" deleted.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete community: ' + err.message);
    }
  };

  // Copy Community Invite Link
  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/communities?community=${activeGuild?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Community invite link copied to clipboard.');
  };

  // Guild Directory Counts
  const totalGuildsCount = dbCommunities.length;
  const joinedCount = useMemo(() => dbCommunities.filter((c) => joined.has(c.id)).length, [dbCommunities, joined]);
  const managedCount = useMemo(
    () =>
      dbCommunities.filter(
        (c) =>
          c.creator_id === session?.user?.id ||
          userRoles[c.id] === 'owner' ||
          userRoles[c.id] === 'admin'
      ).length,
    [dbCommunities, session?.user?.id, userRoles]
  );

  // Filtered Left Rail Communities (Segmented, Searchable, Sorted)
  const filteredRailCommunities = useMemo(() => {
    let list = dbCommunities.filter((c) => {
      // 1. Segment filter
      if (railSegment === 'joined' && !joined.has(c.id)) return false;
      if (railSegment === 'managed') {
        const isManager =
          c.creator_id === session?.user?.id ||
          userRoles[c.id] === 'owner' ||
          userRoles[c.id] === 'admin';
        if (!isManager) return false;
      }

      // 2. Search filter
      if (guildSearch && guildSearch.trim()) {
        const q = guildSearch.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q);
        const matchesTags = Array.isArray(c.tags)
          ? c.tags.some((t) => String(t).toLowerCase().includes(q))
          : String(c.tags || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }

      // 3. Category filter
      if (guildCategoryFilter !== 'all' && c.category !== guildCategoryFilter) {
        return false;
      }

      return true;
    });

    // 4. Sort
    if (guildSort === 'newest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (guildSort === 'alphabetical') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
      list.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
    }

    return list;
  }, [
    dbCommunities,
    railSegment,
    guildSearch,
    guildCategoryFilter,
    guildSort,
    joined,
    userRoles,
    session?.user?.id,
  ]);

  // Filtered Members in Roster Tab
  const filteredRosterMembers = useMemo(() => {
    return guildMembers.filter((m) => {
      const matchesRole =
        memberRoleFilter === 'all' ? true :
        memberRoleFilter === 'admins' ? (m.role === 'owner' || m.role === 'admin' || m.role === 'moderator') :
        m.role === memberRoleFilter;

      const q = memberSearchQuery.toLowerCase();
      const matchesSearch = q
        ? m.profile?.username?.toLowerCase().includes(q) ||
          m.profile?.full_name?.toLowerCase().includes(q) ||
          m.profile?.bio?.toLowerCase().includes(q)
        : true;

      return matchesRole && matchesSearch;
    });
  }, [guildMembers, memberRoleFilter, memberSearchQuery]);

  return (
    <div className="min-h-screen bg-[#faf6f0] dark:bg-[#150f0c] text-[#1c130d] dark:text-[#faf6f0] transition-colors duration-200 pb-20 select-none">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-6 space-y-6">

        {/* =========================================================================
            TOP WORKSPACE BAR: SAAS BREADCRUMB & PRIMARY ACTION
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f1e4d3] dark:border-[#33261d] pb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Terminal size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#1c130d] dark:text-white">
                  Engineering Communities
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22] font-bold">
                  {dbCommunities.length} Active
                </span>
              </div>
              <p className="text-xs text-[#6b5546] dark:text-[#c4aba0]">
                Specialized technical guilds for code collaboration, security audits, and systems architecture.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Community</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN 2-COLUMN SAAS WORKSPACE (CLEAN & UNCLUTTERED)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* -----------------------------------------------------------------------
              LEFT COLUMN: COMMUNITIES DISCOVERY RAIL (Sticky on Desktop)
              ----------------------------------------------------------------------- */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-3 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto custom-scrollbar">
            <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
              {/* Directory Header with Quick Create Action */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-[#ea580c] flex items-center justify-center border border-orange-500/20">
                    <Terminal size={14} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-[#1c130d] dark:text-white">
                      Guild Directory
                    </h2>
                    <p className="text-[10px] text-[#8d7565]">
                      {filteredRailCommunities.length} {filteredRailCommunities.length === 1 ? 'guild' : 'guilds'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 text-[#ea580c] border border-orange-200 dark:border-orange-900/40 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Create new guild"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </div>

              {/* Segmentation Tabs (All Guilds / Joined / Managed) */}
              <div className="flex items-center p-1 bg-[#faf6f0] dark:bg-[#281f18] rounded-xl border border-[#f1e4d3] dark:border-[#382b22]">
                {[
                  { id: 'all', label: 'All', count: totalGuildsCount },
                  { id: 'joined', label: 'Joined', count: joinedCount },
                  { id: 'managed', label: 'Managed', count: managedCount },
                ].map((tab) => {
                  const isSelected = railSegment === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setRailSegment(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-[#1f1813] text-[#ea580c] shadow-xs border border-[#f1e4d3] dark:border-[#382b22]'
                          : 'text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-orange-100 dark:bg-orange-950/70 text-[#ea580c] font-black'
                          : 'bg-stone-200/60 dark:bg-stone-800 text-[#8d7565]'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Guild Search Input with Instant Clear */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, topic, or tag…"
                  value={guildSearch}
                  onChange={(e) => setGuildSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-7 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                />
                {guildSearch && (
                  <button
                    onClick={() => setGuildSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8d7565] hover:text-[#1c130d] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Filter Chips with Lucide Icons */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {COMMUNITY_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = guildCategoryFilter === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setGuildCategoryFilter(cat.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-[#ea580c] text-white shadow-2xs'
                          : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
                      }`}
                    >
                      <CatIcon size={11} className={isSelected ? 'text-white' : 'text-[#ea580c]'} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sort Bar */}
              <div className="flex items-center justify-between text-[10px] text-[#8d7565] pt-0.5 px-0.5">
                <span className="font-semibold uppercase tracking-wider text-[9px]">Sort by:</span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'popular', label: 'Members' },
                    { id: 'newest', label: 'Newest' },
                    { id: 'alphabetical', label: 'A-Z' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setGuildSort(s.id)}
                      className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                        guildSort === s.id
                          ? 'text-[#ea580c] bg-orange-100 dark:bg-orange-950/60'
                          : 'hover:text-[#1c130d] dark:hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-[#f1e4d3] dark:border-[#33261d]" />

              {/* Streamlined Communities List */}
              <div className="space-y-1 max-h-[560px] overflow-y-auto custom-scrollbar pr-0.5">
                {filteredRailCommunities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#8d7565] space-y-2">
                    <p>No guilds found in this view.</p>
                    {railSegment !== 'all' && (
                      <button
                        onClick={() => setRailSegment('all')}
                        className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
                      >
                        Explore all guilds
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRailCommunities.map((comm) => {
                    const isSelected = activeGuild?.id === comm.id;
                    const isUserJoined = joined.has(comm.id);
                    const isUserAdmin =
                      comm.creator_id === session?.user?.id ||
                      userRoles[comm.id] === 'owner' ||
                      userRoles[comm.id] === 'admin';

                    return (
                      <div
                        key={comm.id}
                        onClick={() => handleSelectGuild(comm.id)}
                        className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer group relative ${
                          isSelected
                            ? 'bg-orange-50/90 dark:bg-[#281c14] border border-orange-300 dark:border-orange-800 text-[#ea580c] shadow-2xs'
                            : 'hover:bg-[#faf6f0] dark:hover:bg-[#281f18] text-[#6b5546] dark:text-[#a89080] border border-transparent'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#ea580c]" />
                        )}

                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-1">
                          <span className="w-8 h-8 rounded-xl bg-[#fff7ed] dark:bg-[#281f18] border border-[#fed7aa] dark:border-[#382b22] flex items-center justify-center shrink-0">
                            {renderTechIcon(comm, 15)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate text-[#1c130d] dark:text-white group-hover:text-[#ea580c] transition-colors">
                                {comm.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#8d7565] dark:text-[#a89080] truncate">
                              <span>{comm.member_count || 1} members</span>
                              <span>•</span>
                              <span className="capitalize">{comm.category || 'Guild'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isUserAdmin ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                              <Shield size={9} /> Admin
                            </span>
                          ) : isUserJoined ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-0.5">
                              <Check size={9} /> Joined
                            </span>
                          ) : (
                            <button
                              onClick={(e) => toggleJoin(comm, e)}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#ea580c] hover:bg-orange-50 dark:hover:bg-orange-950/40 border border-[#f1e4d3] dark:border-[#382b22] opacity-80 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Join guild"
                            >
                              + Join
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Directory Summary Footer */}
              <div className="pt-2 border-t border-[#f1e4d3] dark:border-[#33261d] flex items-center justify-between text-[10px] text-[#8d7565]">
                <span>Joined {joinedCount} of {totalGuildsCount} guilds</span>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="font-bold text-[#ea580c] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  <Plus size={10} /> Create
                </button>
              </div>
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              RIGHT COLUMN: ACTIVE WORKSPACE (flex-1 / 8 cols)
              ----------------------------------------------------------------------- */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-4 min-w-0">
            {activeGuild ? (
              <div className="space-y-4">

                {/* 1. Sleek Community Header Card */}
                <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-orange-500/5 dark:bg-[#281f18] border border-orange-200 dark:border-[#423124] flex items-center justify-center shrink-0 shadow-2xs">
                        {renderTechIcon(activeGuild, 28)}
                      </span>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-[#1c130d] dark:text-white">
                            {activeGuild.name}
                          </h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22]">
                            {activeGuild.category || 'Security'}
                          </span>
                          {isCurrentAdmin && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <Shield size={10} /> Admin
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#6b5546] dark:text-[#c4aba0] leading-relaxed max-w-2xl">
                          {activeGuild.description || 'Collaborative engineering hub on Connectra.'}
                        </p>

                        <div className="flex items-center gap-3 pt-1 text-[11px] text-[#8d7565] font-mono">
                          <span>@{activeGuild.slug}</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold flex items-center gap-1">
                            <Users size={12} />
                            <span>{activeGuild.member_count || 0} Members</span>
                          </span>
                          <span>•</span>
                          <span className="font-sans">Created {timeAgo(activeGuild.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 shrink-0 self-start">
                      <button
                        onClick={(e) => toggleJoin(activeGuild, e)}
                        disabled={joiningId === activeGuild.id}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                          isCurrentJoined
                            ? 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] border border-[#f1e4d3] dark:border-[#382b22] hover:text-rose-600'
                            : 'bg-[#ea580c] hover:bg-orange-600 text-white shadow-xs'
                        }`}
                      >
                        {isCurrentJoined ? <Check size={12} className="text-emerald-500" /> : <Plus size={12} />}
                        <span>{isCurrentJoined ? 'Joined' : 'Join Guild'}</span>
                      </button>

                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white hover:border-[#ea580c] hover:text-[#ea580c] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Invite or Add Collaborators"
                      >
                        <UserPlus size={13} className="text-[#ea580c]" />
                        <span>Invite</span>
                      </button>

                      <button
                        onClick={handleCopyInviteLink}
                        className="p-2 rounded-xl bg-white dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:text-[#ea580c] transition-colors cursor-pointer"
                        title="Share Link"
                      >
                        <Share2 size={14} />
                      </button>

                      {isCurrentAdmin && (
                        <button
                          onClick={() => setActiveWorkspaceTab('settings')}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            activeWorkspaceTab === 'settings'
                              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-400'
                              : 'bg-white dark:bg-[#281f18] border-[#f1e4d3] dark:border-[#382b22] text-[#8d7565] hover:text-[#ea580c]'
                          }`}
                          title="Admin Settings"
                        >
                          <Settings size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Technical Tags */}
                  {activeGuild.tags && activeGuild.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#f1e4d3] dark:border-[#33251c]">
                      <span className="text-[10px] font-bold text-[#8d7565] uppercase mr-1">Topics:</span>
                      {(Array.isArray(activeGuild.tags) ? activeGuild.tags : String(activeGuild.tags).split(',')).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] dark:text-[#a89080] border border-[#f1e4d3] dark:border-[#382b22]"
                        >
                          #{String(t).trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Workspace Tabs Navigation */}
                <div className="flex items-center gap-2 border-b border-[#f1e4d3] dark:border-[#33261d] pb-2 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setActiveWorkspaceTab('feed')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeWorkspaceTab === 'feed'
                        ? 'bg-[#1c130d] text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-white dark:bg-[#1f1813] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
                    }`}
                  >
                    <MessageSquare size={13} className={activeWorkspaceTab === 'feed' ? 'text-orange-400' : ''} />
                    <span>Discussions & Feed</span>
                  </button>

                  <button
                    onClick={() => setActiveWorkspaceTab('members')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeWorkspaceTab === 'members'
                        ? 'bg-[#1c130d] text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-white dark:bg-[#1f1813] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
                    }`}
                  >
                    <Users size={13} className={activeWorkspaceTab === 'members' ? 'text-emerald-400' : ''} />
                    <span>Members & Roles ({activeGuild.member_count || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveWorkspaceTab('about')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeWorkspaceTab === 'about'
                        ? 'bg-[#1c130d] text-white dark:bg-white dark:text-black shadow-xs'
                        : 'bg-white dark:bg-[#1f1813] text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white border border-[#f1e4d3] dark:border-[#382b22]'
                    }`}
                  >
                    <ShieldCheck size={13} className={activeWorkspaceTab === 'about' ? 'text-blue-400' : ''} />
                    <span>About & Guidelines</span>
                  </button>

                  {isCurrentAdmin && (
                    <button
                      onClick={() => setActiveWorkspaceTab('settings')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeWorkspaceTab === 'settings'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                      }`}
                    >
                      <Settings size={13} />
                      <span>Admin Console</span>
                    </button>
                  )}
                </div>

                {/* 3. Workspace Tab Viewports */}
                {activeWorkspaceTab === 'feed' && (
                  /* TAB 1: DISCUSSIONS FEED */
                  <CommunityErrorBoundary key={activeGuild.id}>
                    <CommunityFeed
                      session={session}
                      community={activeGuild}
                      communityId={activeGuild.id}
                      isJoined={isCurrentJoined}
                      isAdmin={isCurrentAdmin}
                      onToggleJoin={(e) => toggleJoin(activeGuild, e)}
                      onCommunityUpdated={fetchData}
                    />
                  </CommunityErrorBoundary>
                )}

                {activeWorkspaceTab === 'members' && (
                  /* TAB 2: MEMBERS & ROLES DIRECTORY (100% REAL DATABASE MEMBERS) */
                  <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f1e4d3] dark:border-[#33251c]">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#1c130d] dark:text-white flex items-center gap-2">
                          <Users size={16} className="text-[#ea580c]" />
                          <span>Community Roster ({guildMembers.length} Members)</span>
                        </h3>
                        <p className="text-xs text-[#8d7565]">
                          Manage team access, promote moderators, and view members verified in database.
                        </p>
                      </div>

                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <UserPlus size={13} />
                        <span>+ Add / Invite Member</span>
                      </button>
                    </div>

                    {/* Member Controls: Search & Role Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7565] pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search members by username..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {['all', 'admins', 'member'].map((r) => (
                          <button
                            key={r}
                            onClick={() => setMemberRoleFilter(r)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize cursor-pointer ${
                              memberRoleFilter === r
                                ? 'bg-[#1c130d] text-white dark:bg-white dark:text-black'
                                : 'bg-[#faf6f0] dark:bg-[#281f18] text-[#8d7565] hover:text-[#1c130d] border border-[#f1e4d3] dark:border-[#382b22]'
                            }`}
                          >
                            {r === 'all' ? 'All Roles' : r === 'admins' ? 'Admins & Mods' : 'Members'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Members List */}
                    {loadingMembers ? (
                      <div className="p-8 text-center text-xs text-[#8d7565]">
                        Loading community roster from database...
                      </div>
                    ) : filteredRosterMembers.length === 0 ? (
                      <div className="p-12 text-center rounded-2xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] space-y-2">
                        <Users size={28} className="mx-auto text-orange-500 opacity-50" />
                        <h4 className="text-xs font-bold text-[#1c130d] dark:text-white">No members matched the filter</h4>
                        <p className="text-xs text-[#8d7565]">Invite fellow engineers to join this community workspace.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#f1e4d3] dark:divide-[#33251c]">
                        {filteredRosterMembers.map((member) => {
                          const prof = member.profile;
                          const isLead = member.role === 'owner' || activeGuild.creator_id === member.user_id;

                          return (
                            <div key={member.id} className="py-3.5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={prof.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                  alt={prof.username}
                                  className="w-10 h-10 rounded-xl object-cover border border-[#f1e4d3] dark:border-[#382b22]"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                      to={`/profile/${prof.username}`}
                                      className="font-bold text-xs text-[#1c130d] dark:text-white hover:text-orange-500 transition-colors truncate"
                                    >
                                      {prof.full_name || prof.username}
                                    </Link>
                                    <span className="text-xs text-[#8d7565] truncate">@{prof.username}</span>

                                    {/* Role Badge */}
                                    <span
                                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                        isLead
                                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                          : member.role === 'moderator'
                                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                          : 'bg-stone-100 dark:bg-stone-800 text-[#8d7565] border-stone-200 dark:border-stone-700'
                                      }`}
                                    >
                                      {isLead ? 'Lead Architect' : member.role}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#8d7565]">
                                    <span>Joined {timeAgo(member.joined_at)}</span>
                                    <span>•</span>
                                    <span>Lvl {prof.level || 1} ({prof.xp || 0} XP)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Admin Actions on Member */}
                              {isCurrentAdmin && !isLead && member.user_id !== session?.user?.id && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white outline-none cursor-pointer"
                                  >
                                    <option value="member">Member</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="admin">Admin</option>
                                  </select>

                                  <button
                                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                                    className="p-1.5 rounded-lg text-[#8d7565] hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Remove from Community"
                                  >
                                    <UserMinus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeWorkspaceTab === 'about' && (
                  /* TAB 3: ABOUT & COMMUNITY GUIDELINES */
                  <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-[#1c130d] dark:text-white flex items-center gap-2 mb-2">
                        <BookOpen size={16} className="text-[#ea580c]" />
                        <span>About {activeGuild.name}</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-[#6b5546] dark:text-[#c4aba0] leading-relaxed">
                        {activeGuild.description || 'Dedicated technical guild for specialized engineering collaboration.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-[#f1e4d3] dark:border-[#33251c] space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#ea580c] flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        <span>Verified Guild Guidelines</span>
                      </h4>
                      <ul className="space-y-2 text-xs text-[#6b5546] dark:text-[#c4aba0]">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>All code snippets must follow zero-trust security standards. Secret tokens and credentials are automatically redacted.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>Constructive architecture feedback: accompany critical reviews with actionable solutions and reproduction test cases.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>Keep discussions technical, actionable, and aligned with guild tags and topics.</span>
                        </li>
                      </ul>
                    </div>

                    {activeGuild.profiles && (
                      <div className="pt-4 border-t border-[#f1e4d3] dark:border-[#33251c] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={activeGuild.profiles.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-[#f1e4d3] dark:border-[#382b22]"
                          />
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#8d7565]">Guild Founder</span>
                            <Link
                              to={`/profile/${activeGuild.profiles.username}`}
                              className="text-xs font-bold text-[#1c130d] dark:text-white hover:text-orange-500 block"
                            >
                              @{activeGuild.profiles.username}
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeWorkspaceTab === 'settings' && isCurrentAdmin && (
                  /* TAB 4: ADMIN CONSOLE & COMMUNITY SETTINGS */
                  <div className="bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
                    <div className="border-b border-[#f1e4d3] dark:border-[#33251c] pb-4">
                      <h3 className="text-sm sm:text-base font-extrabold text-[#1c130d] dark:text-white flex items-center gap-2">
                        <Settings size={16} className="text-amber-600" />
                        <span>Community Administration</span>
                      </h3>
                      <p className="text-xs text-[#8d7565]">
                        Manage metadata, category classification, privacy, and community lifecycle in Supabase.
                      </p>
                    </div>

                    <form onSubmit={handleSaveEdit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#1c130d] dark:text-white">Community Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#1c130d] dark:text-white">Category</label>
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                        >
                          <option value="Security">Security & Audits</option>
                          <option value="AI & ML">AI & Agentic Systems</option>
                          <option value="Systems">Systems & Rust</option>
                          <option value="Cloud">Cloud & DevOps</option>
                          <option value="Web">Web & TypeScript</option>
                          <option value="Data">Data & Microservices</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#1c130d] dark:text-white">Description</label>
                        <textarea
                          rows={3}
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#1c130d] dark:text-white">Technical Tags (comma separated)</label>
                        <input
                          type="text"
                          value={editForm.tags}
                          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="px-5 py-2.5 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {savingEdit ? 'Saving Changes...' : 'Save Settings'}
                      </button>
                    </form>

                    {/* Danger Zone: Community Deletion */}
                    <div className="pt-6 border-t border-rose-200 dark:border-rose-950/60 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <Trash2 size={13} />
                        <span>Danger Zone</span>
                      </h4>
                      <p className="text-xs text-[#8d7565]">
                        Permanently delete this community, its posts, and member associations. This action cannot be reversed.
                      </p>
                      <button
                        type="button"
                        onClick={handleDeleteCommunity}
                        className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Delete Community Permanently
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-16 text-center rounded-3xl bg-white dark:bg-[#1a1410] border border-[#f1e4d3] dark:border-[#382b22] space-y-3">
                <Compass size={40} className="mx-auto text-orange-500 opacity-40 animate-pulse" />
                <h3 className="font-extrabold text-base text-[#1c130d] dark:text-white">Select a Community</h3>
                <p className="text-xs text-[#8d7565]">Choose a community from the left rail or launch a new guild.</p>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* =========================================================================
          INVITE & ADD MEMBERS MODAL (ADMIN & TEAM MANAGEMENT)
          ========================================================================= */}
      <AnimatePresence>
        {showInviteModal && activeGuild && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[#f1e4d3] dark:border-[#33251c] pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus size={18} className="text-[#ea580c]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#1c130d] dark:text-white">
                    Invite Collaborators to {activeGuild.name}
                  </h3>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 1. Shareable Link Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8d7565] uppercase">Shareable Guild Invite Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/communities?community=${activeGuild.id}`}
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white font-mono select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-4 py-2.5 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copy</span>
                  </button>
                </div>
              </div>

              <div className="h-px bg-[#f1e4d3] dark:bg-[#33251c]" />

              {/* 2. Direct Database Search & Add */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#8d7565] uppercase">Add Developer Directly</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#8d7565]">Assign Role:</span>
                    <select
                      value={selectedRoleToAssign}
                      onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white outline-none cursor-pointer"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8d7565] pointer-events-none" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Search developer by username or full name..."
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                {/* Search Results List */}
                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                  {searchingUsers ? (
                    <p className="text-xs text-[#8d7565] py-2 text-center">Searching database profiles...</p>
                  ) : userSearchResults.length > 0 ? (
                    userSearchResults.map((user) => {
                      const isAlreadyMember = guildMembers.some((m) => m.user_id === user.id);

                      return (
                        <div
                          key={user.id}
                          className="p-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate text-[#1c130d] dark:text-white">
                                {user.full_name || user.username}
                              </span>
                              <span className="text-[10px] text-[#8d7565] block truncate">@{user.username}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAlreadyMember || addingUserId === user.id}
                            onClick={() => handleAddMember(user.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isAlreadyMember
                                ? 'bg-stone-200 dark:bg-stone-800 text-[#8d7565] cursor-not-allowed'
                                : 'bg-[#ea580c] hover:bg-orange-600 text-white shadow-2xs'
                            }`}
                          >
                            {isAlreadyMember ? 'Already in Guild' : addingUserId === user.id ? 'Adding...' : 'Add to Guild'}
                          </button>
                        </div>
                      );
                    })
                  ) : userSearchQuery ? (
                    <p className="text-xs text-[#8d7565] py-2 text-center">No developers found matching "{userSearchQuery}".</p>
                  ) : (
                    <p className="text-xs text-[#8d7565] py-2 text-center">Type a username to discover engineers to add.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          CREATE COMMUNITY MODAL (CLEAN SAAS FORM)
          ========================================================================= */}
      <AnimatePresence>
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-[#1f1813] border border-[#f1e4d3] dark:border-[#382b22] rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#f1e4d3] dark:border-[#33251c] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-[#ea580c]" />
                  <h3 className="font-extrabold text-sm sm:text-base text-[#1c130d] dark:text-white">
                    Create Technical Guild
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateCommunity} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c130d] dark:text-white">Community Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Systems & Go"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c130d] dark:text-white">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white focus:outline-none focus:border-[#ea580c]"
                  >
                    <option value="Security">Security & Audits</option>
                    <option value="AI & ML">AI & Agentic Systems</option>
                    <option value="Systems">Systems & Rust</option>
                    <option value="Cloud">Cloud & DevOps</option>
                    <option value="Web">Web & TypeScript</option>
                    <option value="Data">Data & Async Microservices</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c130d] dark:text-white">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Focus area, mission, and technical goals..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1c130d] dark:text-white">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="Rust, Linux, Concurrency"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#faf6f0] dark:bg-[#281f18] border border-[#f1e4d3] dark:border-[#382b22] text-[#1c130d] dark:text-white placeholder:text-[#8d7565] focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1e4d3] dark:border-[#33251c]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#8d7565] hover:text-[#1c130d] dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="px-5 py-2 rounded-xl bg-[#ea580c] hover:bg-orange-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {submittingCreate ? 'Creating...' : 'Create Guild'}
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
