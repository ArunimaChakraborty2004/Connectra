import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Users, Plus, Search, Globe, Lock, X, ChevronRight } from 'lucide-react';
import { CardSkeleton } from '../components/ui/SkeletonLoader';

const DEFAULT_ICONS = ['🤖', '🔐', '🌐', '📦', '☁️', '📱', '⚡', '🎯', '🛠️', '🎨', '🐍', '💡'];

export default function CommunitiesPage({ session }) {
  const [communities, setCommunities] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '💡', is_private: false });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: comms }, { data: memberships }] = await Promise.all([
      supabase.from('communities').select('*, community_members(count)').order('member_count', { ascending: false }),
      supabase.from('community_members').select('community_id').eq('user_id', session.user.id),
    ]);
    setCommunities(comms || []);
    setJoined(new Set((memberships || []).map(m => m.community_id)));
    setLoading(false);
  };

  const toggleJoin = async (community) => {
    const isJoined = joined.has(community.id);
    if (isJoined) {
      await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', session.user.id);
      await supabase.from('communities').update({ member_count: Math.max(0, community.member_count - 1) }).eq('id', community.id);
      setJoined(prev => { const s = new Set(prev); s.delete(community.id); return s; });
      setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c));
      toast.success(`Left ${community.name}`);
    } else {
      await supabase.from('community_members').insert({ community_id: community.id, user_id: session.user.id });
      await supabase.from('communities').update({ member_count: community.member_count + 1 }).eq('id', community.id);
      setJoined(prev => new Set([...prev, community.id]));
      setCommunities(prev => prev.map(c => c.id === community.id ? { ...c, member_count: c.member_count + 1 } : c));
      toast.success(`Joined ${community.name}!`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setSubmitting(true);
    const { data, error } = await supabase
      .from('communities')
      .insert({ ...form, slug, creator_id: session.user.id })
      .select()
      .single();
    if (error) {
      toast.error(error.message.includes('unique') ? 'Community name already taken' : 'Failed to create community');
    } else {
      await supabase.from('community_members').insert({ community_id: data.id, user_id: session.user.id, role: 'owner' });
      setCommunities(prev => [data, ...prev]);
      setJoined(prev => new Set([...prev, data.id]));
      setShowForm(false);
      setForm({ name: '', description: '', icon: '💡', is_private: false });
      toast.success('Community created!');
    }
    setSubmitting(false);
  };

  const filtered = communities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center">
                <Users size={20} className="text-green-400" />
              </div>
              Communities
            </h1>
            <p className="text-muted mt-1">Find your tribe. Join developer communities.</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="vibrant-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 self-start">
            <Plus size={16} /> Create Community
          </button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search communities..."
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl">
            <Users size={64} className="mx-auto mb-4 text-muted opacity-20" />
            <h3 className="text-lg font-semibold">No communities found</h3>
            <p className="text-muted text-sm">Create the first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((community, i) => (
              <motion.div key={community.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-panel rounded-2xl p-5 flex flex-col hover:border-border-hover transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{community.icon}</div>
                  {community.is_private
                    ? <Lock size={14} className="text-muted mt-1" />
                    : <Globe size={14} className="text-muted mt-1" />
                  }
                </div>
                <h3 className="font-bold text-main mb-1">{community.name}</h3>
                <p className="text-sm text-muted line-clamp-2 flex-1 mb-4">{community.description || 'A developer community'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Users size={12} /> {community.member_count || 0} members
                  </span>
                  <div className="flex gap-2">
                    <Link to={`/communities/${community.id}`}
                      className="p-2 text-muted hover:text-primary transition-colors">
                      <ChevronRight size={16} />
                    </Link>
                    <button
                      onClick={() => toggleJoin(community)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        joined.has(community.id)
                          ? 'bg-surface text-muted border-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/20'
                          : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'
                      }`}>
                      {joined.has(community.id) ? 'Leave' : 'Join'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-color)] border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Community</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-muted hover:text-main"><X size={20} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_ICONS.map(icon => (
                      <button key={icon} type="button" onClick={() => setForm(p => ({ ...p, icon }))}
                        className={`text-2xl p-2 rounded-xl transition-all border ${form.icon === icon ? 'bg-primary/10 border-primary/30' : 'bg-surface border-border hover:border-border-hover'}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Community name *"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="What is this community about?" rows={3}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 resize-none" />
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.is_private} onChange={e => setForm(p => ({ ...p, is_private: e.target.checked }))}
                    className="w-4 h-4 accent-purple-500" />
                  <span className="text-sm text-muted">Private community (invite only)</span>
                </label>
                <button type="submit" disabled={submitting}
                  className="w-full vibrant-btn py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Community'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
