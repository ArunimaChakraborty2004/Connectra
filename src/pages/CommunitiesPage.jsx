import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  Activity
} from 'lucide-react';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { CURATED_COMMUNITIES, COMMUNITY_CATEGORIES } from '../data/communitiesData';

const DEFAULT_ICONS = ['🛡️', '🤖', '⚡', '🌐', '☁️', '🐍', '🔐', '🎨', '🚀', '💻', '🎯', '🧬', '🛠️', '📦'];

export default function CommunitiesPage({ session }) {
  const [dbCommunities, setDbCommunities] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular'); // 'popular' | 'active' | 'name'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Security',
    icon: '🛡️',
    tags: 'ZeroTrust, OpenSource',
    is_private: false
  });
  const [submitting, setSubmitting] = useState(false);

  // Initialize and load communities & memberships
  useEffect(() => {
    fetchData();
  }, [session?.user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Load locally cached memberships first
      const localJoined = JSON.parse(localStorage.getItem('connectra_joined_communities') || '[]');
      const joinedSet = new Set(localJoined);

      // Default joined for nice initial demo feel if first time
      if (localJoined.length === 0) {
        joinedSet.add('guild-zerotrust-sec');
        joinedSet.add('guild-ai-agents');
        localStorage.setItem('connectra_joined_communities', JSON.stringify(['guild-zerotrust-sec', 'guild-ai-agents']));
      }

      // 2. Fetch live communities from Supabase
      const { data: comms, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (comms && !error) {
        setDbCommunities(comms);
      }

      // 3. Fetch user memberships from Supabase if logged in
      if (session?.user?.id) {
        const { data: memberships } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', session.user.id);

        if (memberships) {
          memberships.forEach(m => joinedSet.add(m.community_id));
        }
      }

      setJoined(joinedSet);
    } catch (err) {
      console.warn('Communities fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge Curated Guilds + Database Created Communities (prevent duplicates by ID or slug)
  const allCommunities = useMemo(() => {
    const list = [...CURATED_COMMUNITIES];
    dbCommunities.forEach(dbC => {
      const exists = list.some(c => c.id === dbC.id || c.slug === dbC.slug);
      if (!exists) {
        list.unshift({
          id: dbC.id,
          name: dbC.name,
          slug: dbC.slug || dbC.name.toLowerCase().replace(/\s+/g, '-'),
          category: dbC.category || 'Community',
          icon: dbC.icon || '💡',
          banner_url: dbC.banner_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
          description: dbC.description || 'Developer community on Connectra.',
          tags: Array.isArray(dbC.tags) ? dbC.tags : ['Developer', 'Connectra'],
          member_count: dbC.member_count || 1,
          is_private: !!dbC.is_private,
          is_verified: false,
          active_now: Math.floor(Math.random() * 8) + 2,
          is_custom: true,
          created_at: dbC.created_at
        });
      }
    });
    return list;
  }, [dbCommunities]);

  // Handle Join / Leave with Optimistic Updates & Supabase Persistence
  const toggleJoin = async (community, e) => {
    if (e) e.stopPropagation();
    const isJoined = joined.has(community.id);
    const newJoined = new Set(joined);

    if (isJoined) {
      newJoined.delete(community.id);
      setJoined(newJoined);
      localStorage.setItem('connectra_joined_communities', JSON.stringify([...newJoined]));
      toast.success(`Left ${community.name}`);

      if (session?.user?.id && !community.id.startsWith('guild-')) {
        try {
          await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', session.user.id);
          await supabase.from('communities').update({ member_count: Math.max(0, (community.member_count || 1) - 1) }).eq('id', community.id);
        } catch {}
      }
    } else {
      newJoined.add(community.id);
      setJoined(newJoined);
      localStorage.setItem('connectra_joined_communities', JSON.stringify([...newJoined]));
      toast.success(`Welcome to ${community.name}! 🎉`);

      if (session?.user?.id && !community.id.startsWith('guild-')) {
        try {
          await supabase.from('community_members').insert({ community_id: community.id, user_id: session.user.id });
          await supabase.from('communities').update({ member_count: (community.member_count || 0) + 1 }).eq('id', community.id);
        } catch {}
      }
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
      .map(t => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const newCommObj = {
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        icon: form.icon || '🛡️',
        tags: tagArray.length > 0 ? tagArray : ['DevSecOps', 'OpenSource'],
        is_private: form.is_private,
        member_count: 1,
        creator_id: session?.user?.id || null
      };

      let createdData = null;

      // Try inserting into Supabase
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('communities')
          .insert(newCommObj)
          .select()
          .single();

        if (error) {
          if (error.message.includes('unique')) {
            toast.error('Community name already taken. Please choose another.');
            setSubmitting(false);
            return;
          }
          console.warn('Supabase community insert warning:', error);
        } else {
          createdData = data;
          await supabase.from('community_members').insert({
            community_id: data.id,
            user_id: session.user.id,
            role: 'owner'
          });
        }
      }

      // Fallback object if offline or local
      const finalComm = createdData || {
        ...newCommObj,
        id: 'user-comm-' + Date.now(),
        created_at: new Date().toISOString()
      };

      setDbCommunities(prev => [finalComm, ...prev]);
      setJoined(prev => {
        const s = new Set(prev);
        s.add(finalComm.id);
        localStorage.setItem('connectra_joined_communities', JSON.stringify([...s]));
        return s;
      });

      setShowForm(false);
      setForm({
        name: '',
        description: '',
        category: 'Security',
        icon: '🛡️',
        tags: 'ZeroTrust, OpenSource',
        is_private: false
      });
      toast.success('Guild created successfully! You are now the Lead Architect.');
    } catch (err) {
      toast.error('Failed to create community: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Sort Logic
  const filteredCommunities = useMemo(() => {
    let result = allCommunities.filter(c => {
      // Category Filter
      if (selectedCategory === 'joined') {
        if (!joined.has(c.id)) return false;
      } else if (selectedCategory !== 'all') {
        if (c.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }

      // Search Filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesTags = (c.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesTags) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'active') return (b.active_now || 0) - (a.active_now || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b.member_count || 0) - (a.member_count || 0); // popular default
    });

    return result;
  }, [allCommunities, selectedCategory, search, sortBy, joined]);

  // Featured Guild (Zero-Trust Security by default or first curated guild)
  const featuredGuild = allCommunities[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-48 rounded-3xl bg-surface animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main transition-colors duration-200 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* =========================================================================
            1. HERO HUB HEADER & TELEMETRY
            ========================================================================= */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface shadow-xl"
        >
          {/* Subtle Cyber Grid Glow */}
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                <Shield size={13} className="animate-pulse" />
                <span>Zero-Trust Developer Guilds</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-main">
                Technical Guilds & AI Hubs
              </h1>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                Connect with engineers across cybersecurity, multi-agent AI, high-performance systems, and open-source infrastructure. Audit code in public, share architectures, and build together.
              </p>

              {/* Telemetry Micro-Badges */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <strong className="text-main font-bold">{allCommunities.reduce((acc, c) => acc + (c.active_now || 5), 0)}</strong> Devs Active Now
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                  <Users size={13} className="text-primary" />
                  <strong className="text-main font-bold">{allCommunities.length}</strong> Guilds Available
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                  <Code2 size={13} className="text-purple-400" />
                  <span>100% CWE Audited Code</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <button 
                onClick={() => setShowForm(true)}
                className="vibrant-btn px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer"
              >
                <Plus size={18} />
                <span>Create New Guild</span>
              </button>
              <div className="text-center md:text-right">
                <span className="text-[11px] text-muted">
                  {joined.size} guild{joined.size === 1 ? '' : 's'} joined by you
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* =========================================================================
            2. FEATURED GUILD OF THE WEEK SPOTLIGHT
            ========================================================================= */}
        {featuredGuild && selectedCategory === 'all' && !search && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel relative rounded-3xl p-6 sm:p-8 overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-surface to-surface shadow-2xl group"
          >
            <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-surface border-2 border-emerald-500/30 flex items-center justify-center text-4xl sm:text-5xl shadow-md shrink-0">
                  {featuredGuild.icon}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Flame size={12} className="text-emerald-400" /> Spotlight of the Week
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Activity size={12} className="text-emerald-400 animate-pulse" /> {featuredGuild.active_now} online
                    </span>
                  </div>
                  <Link to={`/communities/${featuredGuild.id}`} className="block">
                    <h2 className="text-xl sm:text-2xl font-black text-main group-hover:text-primary transition-colors">
                      {featuredGuild.name}
                    </h2>
                  </Link>
                  <p className="text-xs sm:text-sm text-muted max-w-2xl line-clamp-2">
                    {featuredGuild.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {featuredGuild.tags?.map(tag => (
                      <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface border border-border text-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                <button
                  onClick={(e) => toggleJoin(featuredGuild, e)}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    joined.has(featuredGuild.id)
                      ? 'bg-surface text-muted border border-border hover:bg-red-500/10 hover:text-red-400'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                  }`}
                >
                  {joined.has(featuredGuild.id) ? (
                    <>
                      <Check size={16} /> Joined
                    </>
                  ) : (
                    <>
                      <Plus size={16} /> Join Guild
                    </>
                  )}
                </button>
                <Link
                  to={`/communities/${featuredGuild.id}`}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold glass-panel text-main hover:text-primary flex items-center gap-1 transition-all group-hover:border-primary/40"
                >
                  <span>Explore Hub</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* =========================================================================
            3. SEARCH, CATEGORIES & VIEW CONTROLS
            ========================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search guilds by name, architecture, tech stack (e.g. Rust, Groq, Zero-Trust)..."
                className="w-full bg-surface border border-border rounded-2xl pl-11 pr-10 py-3.5 text-sm text-main placeholder:text-muted/60 focus:outline-none focus:border-primary/50 transition-all shadow-sm"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-main"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sort & View Mode Switches */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-main focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                <option value="popular">Most Members</option>
                <option value="active">Most Active</option>
                <option value="name">Alphabetical</option>
              </select>

              <div className="flex items-center glass-panel p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
                  title="Grid View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
                  title="List View"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {COMMUNITY_CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat.id;
              const count = cat.id === 'all' 
                ? allCommunities.length 
                : cat.id === 'joined'
                  ? joined.size
                  : allCommunities.filter(c => c.category?.toLowerCase() === cat.id.toLowerCase()).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                      : 'glass-panel text-muted hover:text-main hover:border-border-hover'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-surface border border-border text-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            4. GUILDS DIRECTORY (GRID / LIST VIEW)
            ========================================================================= */}
        {filteredCommunities.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-3xl p-8 space-y-4">
            <Compass size={56} className="mx-auto text-muted/30" />
            <h3 className="text-xl font-bold text-main">No guilds found</h3>
            <p className="text-sm text-muted max-w-md mx-auto">
              We couldn't find any communities matching <span className="font-semibold text-main">"{search || selectedCategory}"</span>.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => { setSearch(''); setSelectedCategory('all'); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold glass-panel text-main hover:text-primary cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="vibrant-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Create This Guild
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCommunities.map((community, i) => {
              const isJoined = joined.has(community.id);
              return (
                <motion.div
                  key={community.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="glass-panel rounded-3xl p-5 flex flex-col justify-between hover:border-primary/40 hover:shadow-xl transition-all group relative overflow-hidden"
                >
                  {/* Subtle Top Accent Ribbon */}
                  <div className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${community.gradient || 'from-primary/50 to-amber-500/50'}`} />

                  <div>
                    {/* Top Row: Icon, Privacy Badge, Active Pulse */}
                    <div className="flex items-start justify-between mb-3.5 pt-1">
                      <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-3xl shadow-sm group-hover:scale-105 transition-transform">
                        {community.icon}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {community.is_private ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20" title="Private Zero-Trust Enclave">
                            <Lock size={10} /> Enclave
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Public Open-Source Hub">
                            <Globe size={10} /> Public
                          </span>
                        )}

                        {community.is_verified && (
                          <span className="inline-flex items-center p-1 rounded-full bg-blue-500/10 text-blue-400" title="Verified Connectra Guild">
                            <Shield size={12} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Community Title & Link */}
                    <Link to={`/communities/${community.id}`} className="block">
                      <h3 className="font-extrabold text-base text-main group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
                        {community.name}
                      </h3>
                    </Link>

                    {/* Description */}
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed mb-3.5">
                      {community.description || 'A collaborative developer community.'}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {(community.tags || []).slice(0, 3).map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => { e.stopPropagation(); setSearch(tag); }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface border border-border text-muted hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                      {(community.tags || []).length > 3 && (
                        <span className="text-[10px] text-muted self-center">
                          +{community.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats & Action Bar */}
                  <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-main flex items-center gap-1">
                        <Users size={12} className="text-primary" />
                        <span>{(community.member_count || 1).toLocaleString()}</span>
                      </span>
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{community.active_now || 3} active</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/communities/${community.id}`}
                        className="p-2 text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface"
                        title="View Discussions"
                      >
                        <ChevronRight size={18} />
                      </Link>

                      <button
                        onClick={(e) => toggleJoin(community, e)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isJoined
                            ? 'bg-surface text-muted border-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20'
                            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-sm'
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
          /* LIST VIEW */
          <div className="space-y-3">
            {filteredCommunities.map((community, i) => {
              const isJoined = joined.has(community.id);
              return (
                <motion.div
                  key={community.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center text-2xl shrink-0">
                      {community.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/communities/${community.id}`}>
                          <h3 className="font-bold text-main text-sm sm:text-base group-hover:text-primary transition-colors truncate">
                            {community.name}
                          </h3>
                        </Link>
                        {community.is_verified && (
                          <Shield size={13} className="text-blue-400 shrink-0" />
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                          {community.category || 'Guild'}
                        </span>
                      </div>
                      <p className="text-xs text-muted truncate max-w-xl mt-0.5">
                        {community.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-right">
                      <div className="text-xs font-bold text-main flex items-center gap-1 justify-end">
                        <Users size={12} className="text-primary" />
                        <span>{(community.member_count || 1).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-muted flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{community.active_now || 2} active</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleJoin(community, e)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isJoined
                            ? 'bg-surface text-muted border-border hover:bg-red-500/10 hover:text-red-400'
                            : 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                        }`}
                      >
                        {isJoined ? 'Joined' : 'Join'}
                      </button>
                      <Link
                        to={`/communities/${community.id}`}
                        className="p-2 text-muted hover:text-primary transition-colors rounded-lg"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* =========================================================================
          5. CREATE COMMUNITY MODAL
          ========================================================================= */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-surface border border-border rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative my-auto space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-main">Architect a Technical Guild</h2>
                    <p className="text-xs text-muted">Deploy a zero-trust community for peer collaboration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowForm(false)} 
                  className="p-2 text-muted hover:text-main rounded-xl hover:bg-surface cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Icon Picker */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">
                    Guild Glyph / Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_ICONS.map(icon => (
                      <button 
                        key={icon} 
                        type="button" 
                        onClick={() => setForm(p => ({ ...p, icon }))}
                        className={`text-2xl p-2.5 rounded-xl transition-all border cursor-pointer ${
                          form.icon === icon 
                            ? 'bg-primary/20 border-primary scale-110 shadow-md' 
                            : 'bg-surface border-border hover:border-primary/40'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">
                    Guild Name *
                  </label>
                  <input 
                    required 
                    value={form.name} 
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. LLM Security Red Team"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/60 transition-all" 
                  />
                  {form.name && (
                    <span className="text-[11px] text-muted block mt-1">
                      URL slug: <code className="text-primary">connectra.dev/c/{form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</code>
                    </span>
                  )}
                </div>

                {/* Category & Tags Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-main focus:outline-none focus:border-primary/60 cursor-pointer"
                    >
                      <option value="Security">🛡️ Security & Zero-Trust</option>
                      <option value="AI & ML">🤖 AI & Autonomous Agents</option>
                      <option value="Systems">⚡ Systems & Cloud</option>
                      <option value="Web">🌐 Web & Fullstack</option>
                      <option value="Creative">🎨 Creative Dev</option>
                      <option value="Community">🚀 Founders & Builders</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">
                      Tech Tags (comma separated)
                    </label>
                    <input
                      value={form.tags}
                      onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                      placeholder="Rust, Groq, Wasm"
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/60"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">
                    Mission & Focus
                  </label>
                  <textarea 
                    value={form.description} 
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="What technical challenges will members solve in this guild?" 
                    rows={3}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/60 resize-none" 
                  />
                </div>

                {/* Private Zero-Trust Toggle */}
                <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between cursor-pointer"
                  onClick={() => setForm(p => ({ ...p, is_private: !p.is_private }))}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${form.is_private ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {form.is_private ? <Lock size={16} /> : <Globe size={16} />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-main block">
                        {form.is_private ? 'Private Enclave' : 'Open Public Guild'}
                      </span>
                      <span className="text-xs text-muted">
                        {form.is_private ? 'Invite & whitelist approval only' : 'Anyone can discover and join'}
                      </span>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={form.is_private} 
                    onChange={e => setForm(p => ({ ...p, is_private: e.target.checked }))}
                    className="w-4 h-4 accent-primary cursor-pointer" 
                    onClick={e => e.stopPropagation()}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full vibrant-btn py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    {submitting ? (
                      <span>Deploying Guild...</span>
                    ) : (
                      <>
                        <Shield size={16} />
                        <span>Deploy Guild to Network</span>
                      </>
                    )}
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
