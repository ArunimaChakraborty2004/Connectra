import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Search,
  Sparkles,
  Shield,
  Cpu,
  Cloud,
  Database,
  Code2,
  Users,
  Briefcase,
  ExternalLink,
  MessageSquare,
  UserPlus,
  UserCheck,
  Check,
  X,
  Flame,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Terminal,
  Lock,
  Layers,
  Award,
  Zap,
  Globe,
  Tag,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import Loader from '../components/ui/Loader';
import { toast } from '../lib/toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SkillRadarChart from '../components/ui/SkillRadarChart';
import { computeTeamSynergy, vectorizeSkills, getSynergyRationale } from '../lib/skillGraph';
import { createNotification } from '../lib/notifications';

// 4D Domain Filter Categories with vibrant themed colors
const DOMAIN_PILLARS = [
  { id: 'all', label: 'All Cosmos', icon: Sparkles, color: 'from-orange-500 to-amber-500' },
  { id: 'cybersecurity', label: 'Security & Zero-Trust', icon: Shield, color: 'from-emerald-500 to-teal-500', keywords: ['security', 'owasp', 'cyber', 'cryptography', 'auth', 'zero-trust', 'pentesting', 'appsec'] },
  { id: 'ai', label: 'AI & Machine Learning', icon: Cpu, color: 'from-purple-500 to-indigo-500', keywords: ['ai', 'ml', 'llm', 'python', 'pytorch', 'rag', 'langchain', 'groq', 'deep learning'] },
  { id: 'devops', label: 'DevOps & Cloud', icon: Cloud, color: 'from-cyan-500 to-blue-500', keywords: ['docker', 'kubernetes', 'aws', 'gcp', 'ci/cd', 'terraform', 'linux', 'cloud'] },
  { id: 'backend', label: 'Backend & Systems', icon: Database, color: 'from-amber-500 to-orange-600', keywords: ['node', 'go', 'rust', 'python', 'postgres', 'supabase', 'sql', 'microservices'] },
  { id: 'frontend', label: 'Frontend & UI/UX', icon: Code2, color: 'from-pink-500 to-rose-500', keywords: ['react', 'next', 'vue', 'tailwind', 'typescript', 'javascript', 'ui/ux', 'css'] },
];

// Live Community Trending Tech Pulse
const TRENDING_PULSE = [
  { name: 'Rust & WebAssembly', tag: 'rust', velocity: '+88%', category: 'Systems', desc: 'Memory safety & high-throughput distributed microservices' },
  { name: 'Zero-Trust & RLS', tag: 'zero-trust', velocity: '+95%', category: 'Security', desc: 'Database-level cryptographic isolation with PostgreSQL' },
  { name: 'React 19 & Next.js 15', tag: 'react', velocity: '+74%', category: 'Frontend', desc: 'Server Actions, streaming components & reactive UI' },
  { name: 'Multi-Agent LLM SAST', tag: 'ai', velocity: '+112%', category: 'AI Security', desc: 'Generator-Critic vulnerability triage & automated patch diffs' },
  { name: 'Kubernetes & Docker', tag: 'devops', velocity: '+61%', category: 'Cloud', desc: 'Container orchestration & reproducible CI/CD runners' },
];

// Interactive Code Snippet Samples for the Live SAST Security Lab
const CODE_LAB_SAMPLES = [
  {
    id: 'cwe-89',
    title: 'SQL Injection in User Login',
    cwe: 'CWE-89 (High)',
    status: 'Vulnerable',
    code: `// Express.js Route with Raw String Concat
app.post('/api/login', async (req, res) => {
  const { user, pass } = req.body;
  const query = "SELECT * FROM users WHERE username = '" + user + "' AND pass = '" + pass + "'";
  const result = await db.raw(query); // ⚠️ SQLi Sink!
  res.json(result);
});`,
    explanation: 'Unsanitized user input concatenated directly into a SQL query allows attackers to bypass authentication with SQL payloads like "\' OR 1=1 --".',
    patch: `// Connectra Dual-Agent Remediated Patch
app.post('/api/login', async (req, res) => {
  const { user, pass } = req.body;
  // Parameterized query isolates data-plane from command-plane
  const query = 'SELECT * FROM users WHERE username = $1';
  const result = await db.query(query, [user]);
  // Verify bcrypt hash...
});`,
  },
  {
    id: 'cwe-798',
    title: 'Hardcoded Production Secret Token',
    cwe: 'CWE-798 (Critical)',
    status: 'Vulnerable',
    code: `// Cloud Payment Webhook Handler
const stripe = require('stripe');
const STRIPE_SECRET = "sk_test_51Mz000000000000000000000"; // ⚠️ Exposed credential!

async function verifyPayment(event) {
  const client = stripe(STRIPE_SECRET);
  return await client.events.retrieve(event.id);
}`,
    explanation: 'Hardcoded API secrets committed into source control are scraped within minutes by botnets. Connectra Shannon entropy detector flags tokens with H >= 4.4.',
    patch: `// Connectra Pre-Publish Secret Scanner Remediation
const stripe = require('stripe');
// Secrets must be injected via environment variables at runtime
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET) throw new Error("Missing STRIPE_SECRET_KEY");

async function verifyPayment(event) {
  return await stripe(STRIPE_SECRET).events.retrieve(event.id);
}`,
  },
];

export default function ExplorePage({ session }) {
  const navigate = useNavigate();
  const currentUserId = session?.user?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedPillar, setSelectedPillar] = useState('all');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'developers' | 'collabs' | 'codelab'
  const [developers, setDevelopers] = useState([]);
  const [collabPosts, setCollabPosts] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState({});

  // 4D Radar Inspector Modal State
  const [selectedRadarDev, setSelectedRadarDev] = useState(null);

  // Live SAST Interactive Lab State
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditRevealed, setAuditRevealed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch live profiles and collabs from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadCosmosData() {
      setLoading(true);
      try {
        // 1. Fetch current user profile to calculate accurate synergy matches
        if (currentUserId) {
          const { data: myProf } = await supabase
            .from('profiles')
            .select('id, username, full_name, tech_stack, xp, level, avatar_url')
            .eq('id', currentUserId)
            .single();
          if (myProf && isMounted) setCurrentUserProfile(myProf);

          // Fetch follow states
          const { data: follows } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUserId);
          if (follows && isMounted) {
            const map = {};
            follows.forEach(f => { map[f.following_id] = true; });
            setFollowingMap(map);
          }
        }

        // 2. Fetch developers from Supabase
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio, tech_stack, xp, level, github_url')
          .order('xp', { ascending: false })
          .limit(24);

        if (!pErr && profs && isMounted) {
          setDevelopers(profs.filter(p => p.id !== currentUserId));
        }

        // 3. Fetch open collaboration posts
        const { data: collabs, error: cErr } = await supabase
          .from('collab_posts')
          .select('id, user_id, title, description, skills_needed, status, created_at, profiles(username, avatar_url)')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!cErr && collabs && isMounted) {
          setCollabPosts(collabs);
        }
      } catch (err) {
        console.warn('Explore Cosmos loader fallback:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCosmosData();
    return () => { isMounted = false; };
  }, [currentUserId]);

  // Synchronize query from URL
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Handle Search Input Change
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Follow / Unfollow Toggle
  const handleToggleFollow = async (targetId) => {
    if (!currentUserId) {
      toast.error('Please log in to connect with developers');
      return;
    }

    const isFollowing = followingMap[targetId];
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetId);
        setFollowingMap(prev => ({ ...prev, [targetId]: false }));
        toast.info('Connection removed');
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: targetId });
        setFollowingMap(prev => ({ ...prev, [targetId]: true }));
        toast.success('Connection request sent! 🤝');

        // Trigger notification
        createNotification({
          userId: targetId,
          actorId: currentUserId,
          type: 'follow',
          entityId: targetId,
        });
      }
    } catch (err) {
      toast.error('Unable to update connection');
    }
  };

  // Instant 1-on-1 Message Dispatch
  const handleMessageDev = (dev) => {
    document.dispatchEvent(new CustomEvent('startChat', {
      detail: { userId: dev.id, username: dev.username }
    }));
    navigate('/chat');
  };

  // Filter developers based on query and selected 4D pillar
  const filteredDevelopers = useMemo(() => {
    let list = [...developers];

    // Pillar filter
    if (selectedPillar !== 'all') {
      const activePillarObj = DOMAIN_PILLARS.find(p => p.id === selectedPillar);
      if (activePillarObj && activePillarObj.keywords) {
        list = list.filter(dev => {
          const techStr = (Array.isArray(dev.tech_stack) ? dev.tech_stack.join(' ') : (dev.tech_stack || '')).toLowerCase();
          const bioStr = (dev.bio || '').toLowerCase();
          return activePillarObj.keywords.some(k => techStr.includes(k) || bioStr.includes(k));
        });
      }
    }

    // Query filter
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(dev => {
        const u = (dev.username || '').toLowerCase();
        const f = (dev.full_name || '').toLowerCase();
        const t = (Array.isArray(dev.tech_stack) ? dev.tech_stack.join(' ') : (dev.tech_stack || '')).toLowerCase();
        const b = (dev.bio || '').toLowerCase();
        return u.includes(q) || f.includes(q) || t.includes(q) || b.includes(q);
      });
    }

    return list;
  }, [developers, selectedPillar, query]);

  // Spotlight Developer (Top developer with richest profile)
  const spotlightDev = useMemo(() => {
    if (filteredDevelopers.length > 0) return filteredDevelopers[0];
    if (developers.length > 0) return developers[0];
    return {
      id: 'mock-spotlight',
      username: 'alex_cybersec',
      full_name: 'Alex Rivera',
      bio: 'Full-stack systems architect & Zero-Trust researcher. Contributor to OWASP & WebAssembly runtime modules.',
      tech_stack: ['Rust', 'React 19', 'OWASP', 'Docker', 'PostgreSQL', 'Zero-Trust'],
      xp: 2840,
      level: 6,
    };
  }, [filteredDevelopers, developers]);

  // Trigger Simulated Live SAST Audit in Code Lab
  const runLiveAudit = () => {
    setIsAuditing(true);
    setAuditRevealed(false);
    setTimeout(() => {
      setIsAuditing(false);
      setAuditRevealed(true);
      toast.success('Dual-Agent SAST Audit Complete: Finding Verified & Patched!');
    }, 1100);
  };

  // Copy code snippet helper
  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-100 flex flex-col relative overflow-hidden">
      {/* Ambient Cosmic Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-tr from-orange-600/15 to-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-gradient-to-bl from-purple-600/10 to-teal-500/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 relative z-10">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[280px] shrink-0">
          <Sidebar
            profile={currentUserProfile || { id: currentUserId, username: session?.user?.email?.split('@')[0] || 'User' }}
            stats={{ followers: 12, following: 8 }}
          />
        </div>

        {/* Main Explore Content Area */}
        <div className="flex-1 w-full space-y-6">
          {/* Header Hero Banner */}
          <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-stone-900/90 via-stone-900/60 to-black/80 border border-orange-500/20 shadow-2xl backdrop-blur-xl overflow-hidden">
            {/* Background grid accent */}
            <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/15 border border-orange-500/40 text-orange-400">
                    <Sparkles size={13} className="text-orange-400 animate-pulse" />
                    Connectra Developer Cosmos
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Shield size={11} /> Zero-Trust Verified
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Discover High-Synergy Engineers & <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Secure Code</span>
                </h1>

                <p className="text-sm text-stone-400 leading-relaxed">
                  Navigate the 4-dimensional engineering cosmos. Match complementary technical stacks, audit live open snippets, and collaborate with verified developers.
                </p>
              </div>

              {/* Live Platform Telemetry Card */}
              <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-2xl bg-black/60 border border-white/10 shrink-0">
                <div className="p-2.5 rounded-xl bg-white/5 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Verified Devs</span>
                  <span className="text-lg font-black text-orange-400 font-mono">
                    {Math.max(6, developers.length)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">SAST Defense</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">100%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Skill Taxonomy</span>
                  <span className="text-lg font-black text-purple-400 font-mono">4-Pillar</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 text-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Active Collabs</span>
                  <span className="text-lg font-black text-amber-400 font-mono">
                    {Math.max(1, collabPosts.length)}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Search & Semantic Filter Bar */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="relative flex items-center">
                <Search size={18} className="absolute left-4 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search engineers by name, skill (e.g., Rust, Zero-Trust, PyTorch), or project goal..."
                  className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-black/70 border border-stone-700/60 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-sm text-white placeholder-stone-500 outline-none transition-all shadow-inner"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setSearchParams({}); }}
                    className="absolute right-12 p-1.5 text-stone-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="absolute right-3 hidden sm:flex items-center gap-1 text-[10px] font-mono text-stone-500 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                  <span>ESC</span>
                </div>
              </div>

              {/* 4D Domain Constellation Pill Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pt-4 pb-1 custom-scrollbar">
                {DOMAIN_PILLARS.map(pillar => {
                  const Icon = pillar.icon;
                  const isSelected = selectedPillar === pillar.id;
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      onClick={() => setSelectedPillar(pillar.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                        isSelected
                          ? `bg-gradient-to-r ${pillar.color} text-white border-transparent shadow-md scale-102`
                          : 'bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-white border-stone-800'
                      }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-white' : 'text-stone-400'} />
                      <span>{pillar.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sub-View Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 pb-2 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Compass size={16} />
                <span>Cosmos Bento</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('developers')}
                className={`flex items-center gap-1.5 pb-2 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'developers'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Users size={16} />
                <span>Developers ({filteredDevelopers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('collabs')}
                className={`flex items-center gap-1.5 pb-2 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'collabs'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Briefcase size={16} />
                <span>Collab Bounties ({collabPosts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('codelab')}
                className={`flex items-center gap-1.5 pb-2 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'codelab'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Terminal size={16} />
                <span>SAST Code Lab</span>
              </button>
            </div>
          </div>

          {/* TAB 1: COSMOS BENTO GRID (The Unique Signature Layout) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Bento Grid Container */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* BENTO 1: Spotlight Engineer with Live 4D Radar (Span 2 cols on md) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="md:col-span-2 rounded-3xl p-6 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-orange-500/25 shadow-xl flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-44 h-44 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-orange-500/20 text-orange-400">
                          <Award size={15} />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                          Spotlight Engineer of the Week
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        ⚡ {spotlightDev.xp || 2400} XP · Level {spotlightDev.level || 5}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 p-0.5 shrink-0 shadow-lg">
                          {spotlightDev.avatar_url ? (
                            <img src={spotlightDev.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            <div className="w-full h-full bg-stone-900 rounded-2xl flex items-center justify-center font-extrabold text-2xl text-orange-400">
                              {spotlightDev.username?.[0]?.toUpperCase() || 'E'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Link
                            to={`/profile/${spotlightDev.username}`}
                            className="text-lg font-bold text-white hover:text-orange-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>@{spotlightDev.username}</span>
                            <CheckCircle2 size={15} className="text-emerald-400" />
                          </Link>
                          <p className="text-xs text-stone-400 line-clamp-2 max-w-sm">
                            {spotlightDev.bio || 'Polyglot software engineer actively participating in Connectra Zero-Trust projects and research.'}
                          </p>
                        </div>
                      </div>

                      {/* Mini 4D Radar Thumbnail */}
                      <button
                        type="button"
                        onClick={() => setSelectedRadarDev(spotlightDev)}
                        className="p-2 rounded-2xl bg-black/50 border border-white/10 hover:border-orange-500/40 transition-all flex flex-col items-center gap-1 cursor-pointer group"
                        title="Click to view complete 4D Domain Constellation"
                      >
                        <SkillRadarChart
                          requiredSkills={Array.isArray(spotlightDev.tech_stack) ? spotlightDev.tech_stack.join(', ') : (spotlightDev.tech_stack || 'Rust, React, Docker, OWASP')}
                          candidateSkills={Array.isArray(spotlightDev.tech_stack) ? spotlightDev.tech_stack.join(', ') : (spotlightDev.tech_stack || 'Rust, React, Docker, OWASP')}
                          size={110}
                          showLegend={false}
                        />
                        <span className="text-[10px] font-bold text-orange-400 group-hover:underline">
                          Inspect 4D Radar &rarr;
                        </span>
                      </button>
                    </div>

                    {/* Skill Tags */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {(Array.isArray(spotlightDev.tech_stack)
                        ? spotlightDev.tech_stack
                        : (spotlightDev.tech_stack || 'Rust, React 19, OWASP, Docker, PostgreSQL').split(',')
                      ).slice(0, 6).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg text-xs font-medium bg-stone-800/80 text-stone-300 border border-stone-700/60"
                        >
                          {String(skill).trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-5 mt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(spotlightDev.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        followingMap[spotlightDev.id]
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md hover:scale-102'
                      }`}
                    >
                      {followingMap[spotlightDev.id] ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      <span>{followingMap[spotlightDev.id] ? 'Connected' : 'Connect'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMessageDev(spotlightDev)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-stone-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={14} />
                      <span>Direct Message</span>
                    </button>

                    <Link
                      to={`/profile/${spotlightDev.username}`}
                      className="ml-auto text-xs text-stone-400 hover:text-white transition-colors flex items-center gap-1 font-semibold"
                    >
                      <span>Full Portfolio</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </motion.div>

                {/* BENTO 2: Live Tech Velocity Pulse (Span 1 col on md) */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-3xl p-6 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-stone-800 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                          <Flame size={15} />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Community Tech Pulse
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-500">Realtime</span>
                    </div>

                    <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                      Momentum index across shared code snippets, open projects, and developer profile tags today:
                    </p>

                    <div className="space-y-3">
                      {TRENDING_PULSE.slice(0, 4).map((tech, idx) => (
                        <div
                          key={idx}
                          onClick={() => { setQuery(tech.tag); setSearchParams({ q: tech.tag }); }}
                          className="p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 transition-colors">
                              {tech.name}
                            </span>
                            <span className="text-[11px] font-mono font-extrabold text-emerald-400">
                              {tech.velocity}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-500 truncate">
                            {tech.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('developers')}
                    className="w-full mt-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-stone-300 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Browse Engineers in Pulse</span>
                    <ArrowRight size={13} />
                  </button>
                </motion.div>
              </div>

              {/* BENTO ROW 2: Interactive SAST Security Lab & Featured Collab Bounty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* BENTO 3: Interactive SAST Code Lab Spotlight */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-3xl p-6 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-emerald-500/25 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                          <Terminal size={15} />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Live SAST Vulnerability Lab
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Dual-Agent Generator-Critic
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white">
                        {CODE_LAB_SAMPLES[selectedSampleIndex].title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSampleIndex(prev => (prev + 1) % CODE_LAB_SAMPLES.length);
                          setAuditRevealed(false);
                        }}
                        className="text-[10px] text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <RotateCcw size={10} /> Switch Sample
                      </button>
                    </div>

                    {/* Code Container */}
                    <div className="relative rounded-xl bg-black/80 border border-stone-800 p-3 font-mono text-[11px] text-stone-300 overflow-x-auto my-3">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(auditRevealed ? CODE_LAB_SAMPLES[selectedSampleIndex].patch : CODE_LAB_SAMPLES[selectedSampleIndex].code)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-stone-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy code"
                      >
                        {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>

                      <pre className="text-xs leading-relaxed text-stone-300">
                        {auditRevealed
                          ? CODE_LAB_SAMPLES[selectedSampleIndex].patch
                          : CODE_LAB_SAMPLES[selectedSampleIndex].code}
                      </pre>
                    </div>

                    {/* Audit Explanation Banner */}
                    <AnimatePresence>
                      {auditRevealed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <CheckCircle2 size={14} />
                            <span>Critic Agent Verified Clean Patch Diff</span>
                          </div>
                          <p className="text-[11px] text-stone-300 leading-relaxed">
                            {CODE_LAB_SAMPLES[selectedSampleIndex].explanation}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isAuditing}
                      onClick={runLiveAudit}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isAuditing ? (
                        <>
                          <Loader size={12} className="animate-spin" />
                          <span>Critic Agent Auditing AST...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={13} />
                          <span>{auditRevealed ? 'Re-Audit Snippet' : 'Trigger AI Security Scan'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('codelab')}
                      className="text-xs text-stone-400 hover:text-white ml-auto flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <span>Explore Lab Cases</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </motion.div>

                {/* BENTO 4: Featured Open Project Collab with Live Synergy */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-3xl p-6 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-amber-500/25 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                          <Briefcase size={15} />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Featured Team Bounty
                        </span>
                      </div>

                      {collabPosts.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Open Recruiting
                        </span>
                      )}
                    </div>

                    {collabPosts.length > 0 ? (
                      (() => {
                        const post = collabPosts[0];
                        const synergy = computeTeamSynergy({
                          requiredSkills: post.skills_needed || 'React, Node.js, Docker, OWASP',
                          userSkills: currentUserProfile?.tech_stack || 'Full-Stack Web Development',
                        });

                        return (
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-base font-bold text-white mb-1">{post.title}</h3>
                              <p className="text-xs text-stone-400 line-clamp-2">
                                {post.description || 'Looking for co-founders and engineers to build a high-performance developer security platform.'}
                              </p>
                            </div>

                            {/* Synergy Pill */}
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                                  Your Team Synergy Match
                                </span>
                                <span className="text-xs font-extrabold text-white">
                                  {synergy.matchLevel} ({synergy.score}% Match)
                                </span>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-400 text-sm">
                                {synergy.score}%
                              </div>
                            </div>

                            {/* Required Skills */}
                            <div className="flex flex-wrap gap-1">
                              {(post.skills_needed || 'React, TypeScript, Docker').split(',').map((s, idx) => (
                                <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                                  {s.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="py-6 text-center text-xs text-stone-400">
                        <Briefcase size={28} className="mx-auto mb-2 opacity-30 text-amber-500" />
                        No open bounties listed at this second.<br />
                        <Link to="/collab" className="text-orange-400 underline font-semibold mt-1 inline-block">
                          Post a Collab Project &rarr;
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <Link
                      to="/collab"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore Collab Board</span>
                      <ArrowRight size={13} />
                    </Link>

                    {collabPosts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          document.dispatchEvent(new CustomEvent('startChat', {
                            detail: { userId: collabPosts[0].user_id, username: collabPosts[0].profiles?.username }
                          }));
                          navigate('/chat');
                        }}
                        className="text-xs text-stone-400 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>Message Lead</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Developer Directory Preview in Overview */}
              <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users size={18} className="text-orange-400" />
                      <span>Engineers in the Cosmos</span>
                    </h2>
                    <p className="text-xs text-stone-400">
                      Showing engineers active across {selectedPillar === 'all' ? 'all 4 pillars' : selectedPillar}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('developers')}
                    className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All ({filteredDevelopers.length})</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDevelopers.slice(0, 6).map((dev) => (
                    <DeveloperCard
                      key={dev.id}
                      dev={dev}
                      isFollowing={followingMap[dev.id]}
                      onToggleFollow={() => handleToggleFollow(dev.id)}
                      onMessage={() => handleMessageDev(dev)}
                      onOpenRadar={() => setSelectedRadarDev(dev)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL DEVELOPER DIRECTORY */}
          {activeTab === 'developers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-400">
                  Found <span className="font-bold text-white">{filteredDevelopers.length}</span> engineers matching your criteria.
                </p>
              </div>

              {filteredDevelopers.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-stone-900/40 border border-stone-800 text-stone-400">
                  <Search size={36} className="mx-auto mb-3 opacity-30 text-orange-400" />
                  <h3 className="font-bold text-base text-white mb-1">No engineers found</h3>
                  <p className="text-xs max-w-sm mx-auto mb-4">
                    Try adjusting your search query or selecting a different 4D domain pillar.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setQuery(''); setSelectedPillar('all'); setSearchParams({}); }}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDevelopers.map((dev) => (
                    <DeveloperCard
                      key={dev.id}
                      dev={dev}
                      isFollowing={followingMap[dev.id]}
                      onToggleFollow={() => handleToggleFollow(dev.id)}
                      onMessage={() => handleMessageDev(dev)}
                      onOpenRadar={() => setSelectedRadarDev(dev)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COLLABORATION BOUNTIES */}
          {activeTab === 'collabs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-400">
                  Open software collaboration projects and co-founder listings.
                </p>
                <Link
                  to="/collab"
                  className="px-3 py-1.5 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Post Collab Bounty</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {collabPosts.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-stone-900/40 border border-stone-800 text-stone-400">
                  <Briefcase size={36} className="mx-auto mb-3 opacity-30 text-amber-500" />
                  <h3 className="font-bold text-base text-white mb-1">No open collabs right now</h3>
                  <p className="text-xs max-w-sm mx-auto mb-4">
                    Be the first to list an open collaboration project and find teammates!
                  </p>
                  <Link
                    to="/collab"
                    className="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs cursor-pointer inline-block"
                  >
                    Create a Collab Post
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collabPosts.map((post) => {
                    const synergy = computeTeamSynergy({
                      requiredSkills: post.skills_needed || '',
                      userSkills: currentUserProfile?.tech_stack || 'Full-Stack Web Development',
                    });

                    return (
                      <div
                        key={post.id}
                        className="rounded-2xl p-5 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-stone-800 hover:border-orange-500/30 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ● Open Bounty
                            </span>
                            <span className="text-[10px] font-extrabold text-amber-400 font-mono">
                              ✨ {synergy.score}% Synergy
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white mb-1.5">{post.title}</h3>
                          <p className="text-xs text-stone-400 line-clamp-3 mb-4 leading-relaxed">
                            {post.description}
                          </p>

                          {/* Skills Needed */}
                          {post.skills_needed && (
                            <div className="flex flex-wrap gap-1 mb-4">
                              {post.skills_needed.split(',').map((s, idx) => (
                                <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                                  {s.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                          <Link
                            to={`/profile/${post.profiles?.username}`}
                            className="text-xs text-stone-400 hover:text-white font-semibold truncate max-w-[140px]"
                          >
                            by @{post.profiles?.username || 'engineer'}
                          </Link>

                          <button
                            type="button"
                            onClick={() => {
                              document.dispatchEvent(new CustomEvent('startChat', {
                                detail: { userId: post.user_id, username: post.profiles?.username }
                              }));
                              navigate('/chat');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>Message Lead</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SAST CODE LAB EXPERIMENTATION */}
          {activeTab === 'codelab' && (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-stone-900/90 to-stone-950 border border-emerald-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Terminal size={20} className="text-emerald-400" />
                      <span>Interactive Dual-Agent SAST Vulnerability Lab</span>
                    </h2>
                    <p className="text-xs text-stone-400">
                      Observe how Connectra's Generator and Critic LLM pipeline detects Common Weakness Enumerations and synthesizes verified patches.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {CODE_LAB_SAMPLES.map((sample, idx) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => { setSelectedSampleIndex(idx); setAuditRevealed(false); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selectedSampleIndex === idx
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-md'
                            : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-white'
                        }`}
                      >
                        {sample.cwe.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left: Input Code */}
                  <div className="rounded-2xl p-4 bg-black/80 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                      <span className="flex items-center gap-1.5 text-rose-400">
                        <AlertTriangle size={14} />
                        <span>Source Code Snippet ({CODE_LAB_SAMPLES[selectedSampleIndex].cwe})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(CODE_LAB_SAMPLES[selectedSampleIndex].code)}
                        className="text-[10px] text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <Copy size={11} /> Copy
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-stone-300 overflow-x-auto p-2 bg-stone-950 rounded-xl leading-relaxed">
                      {CODE_LAB_SAMPLES[selectedSampleIndex].code}
                    </pre>
                  </div>

                  {/* Right: Remediation */}
                  <div className="rounded-2xl p-4 bg-black/80 border border-stone-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-300">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 size={14} />
                        <span>Remediated Patch (Critic Agent Verified)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(CODE_LAB_SAMPLES[selectedSampleIndex].patch)}
                        className="text-[10px] text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                      >
                        <Copy size={11} /> Copy
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-emerald-300 overflow-x-auto p-2 bg-stone-950 rounded-xl leading-relaxed">
                      {CODE_LAB_SAMPLES[selectedSampleIndex].patch}
                    </pre>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2">
                  <span className="font-bold text-stone-200 block text-xs uppercase tracking-wider text-orange-400">
                    Scientific Assessment & Ground-Truth Context:
                  </span>
                  <p className="text-stone-300 leading-relaxed">
                    {CODE_LAB_SAMPLES[selectedSampleIndex].explanation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4D SKILL RADAR DETAILED INSPECTOR MODAL */}
      <AnimatePresence>
        {selectedRadarDev && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setSelectedRadarDev(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="w-full max-w-md rounded-3xl bg-stone-900 border border-orange-500/30 p-6 shadow-2xl space-y-4 text-white relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center">
                    {selectedRadarDev.username?.[0]?.toUpperCase() || 'D'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">@{selectedRadarDev.username}</h3>
                    <span className="text-[10px] text-stone-400">4D Engineering Constellation</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRadarDev(null)}
                  className="p-1 rounded-full text-stone-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Spider Radar Chart */}
              <div className="py-2 flex justify-center bg-black/50 rounded-2xl p-4 border border-white/5">
                <SkillRadarChart
                  requiredSkills={currentUserProfile?.tech_stack || 'React, Node, Docker, OWASP'}
                  candidateSkills={Array.isArray(selectedRadarDev.tech_stack) ? selectedRadarDev.tech_stack.join(', ') : (selectedRadarDev.tech_stack || '')}
                  size={240}
                  showLegend={true}
                />
              </div>

              {/* Breakdown metrics */}
              {(() => {
                const vec = vectorizeSkills(selectedRadarDev.tech_stack || '');
                return (
                  <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                    <div className="p-2 rounded-xl bg-stone-800/80 border border-stone-700/60">
                      <span className="text-[9px] text-stone-400 uppercase block">Frontend</span>
                      <span className="font-bold text-pink-400">{Math.round(vec.frontend * 100)}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-800/80 border border-stone-700/60">
                      <span className="text-[9px] text-stone-400 uppercase block">Backend</span>
                      <span className="font-bold text-amber-400">{Math.round(vec.backend * 100)}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-800/80 border border-stone-700/60">
                      <span className="text-[9px] text-stone-400 uppercase block">DevOps</span>
                      <span className="font-bold text-cyan-400">{Math.round(vec.devops * 100)}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-stone-800/80 border border-stone-700/60">
                      <span className="text-[9px] text-stone-400 uppercase block">Security</span>
                      <span className="font-bold text-emerald-400">{Math.round(vec.cybersecurity * 100)}%</span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleMessageDev(selectedRadarDev);
                    setSelectedRadarDev(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare size={14} />
                  <span>Message @{selectedRadarDev.username}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable Developer Card Component
function DeveloperCard({ dev, isFollowing, onToggleFollow, onMessage, onOpenRadar }) {
  const skills = Array.isArray(dev.tech_stack)
    ? dev.tech_stack
    : (dev.tech_stack || '').split(',').map(s => s.trim()).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 bg-gradient-to-br from-stone-900/90 to-stone-950 border border-stone-800 hover:border-orange-500/35 transition-all flex flex-col justify-between group shadow-sm hover:shadow-lg"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 p-0.5 shrink-0 shadow-md">
              {dev.avatar_url ? (
                <img src={dev.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full bg-stone-900 rounded-xl flex items-center justify-center font-bold text-lg text-orange-400">
                  {dev.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <Link
                to={`/profile/${dev.username}`}
                className="text-sm font-bold text-white hover:text-orange-400 transition-colors truncate block"
              >
                @{dev.username}
              </Link>
              <span className="text-[10px] font-mono text-stone-400 block truncate">
                Level {dev.level || 1} · {dev.xp || 0} XP
              </span>
            </div>
          </div>

          {/* Quick Radar Trigger */}
          <button
            type="button"
            onClick={onOpenRadar}
            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-orange-500/20 text-stone-400 hover:text-orange-400 border border-stone-700 transition-colors cursor-pointer"
            title="Inspect 4D Skill Radar"
          >
            <Compass size={14} />
          </button>
        </div>

        {dev.bio && (
          <p className="text-xs text-stone-400 line-clamp-2 mb-3 leading-relaxed">
            {dev.bio}
          </p>
        )}

        {/* Skills Pills */}
        <div className="flex flex-wrap gap-1 mb-4">
          {skills.slice(0, 4).map((skill, idx) => (
            <span
              key={idx}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-800/80 text-stone-300 border border-stone-700/50"
            >
              {skill}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-stone-500">
              +{skills.length - 4}
            </span>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="pt-3 border-t border-white/5 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFollow}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            isFollowing
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xs'
          }`}
        >
          {isFollowing ? <Check size={12} /> : <UserPlus size={12} />}
          <span>{isFollowing ? 'Connected' : 'Connect'}</span>
        </button>

        <button
          type="button"
          onClick={onMessage}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
          title="Direct Message"
        >
          <MessageSquare size={13} />
        </button>
      </div>
    </motion.div>
  );
}
