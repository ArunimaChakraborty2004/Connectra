import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Users, Code2, Clock, CheckCircle, Briefcase } from 'lucide-react';
import { toast } from '../lib/toast';
import { Link } from 'react-router-dom';
import Loader from '../components/ui/Loader';
import EmptyState from '../components/ui/EmptyState';

function CollabCard({ post, session, onUpdate }) {
  const isOwner = post.user_id === session?.user?.id;
  const skills = post.skills_needed ? post.skills_needed.split(',').map(s => s.trim()) : [];

  const handleClose = async () => {
    const { error } = await supabase
      .from('collab_posts')
      .update({ status: post.status === 'open' ? 'closed' : 'open' })
      .eq('id', post.id);
    if (!error) { toast.success('Status updated!'); onUpdate(); }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('collab_posts').delete().eq('id', post.id);
    if (!error) { toast.success('Post removed!'); onUpdate(); }
  };

  const handleMessage = () => {
    document.dispatchEvent(new CustomEvent('startChat', { detail: { userId: post.user_id, username: post.profiles?.username } }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/20 border border-white/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              post.status === 'open'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}>
              {post.status === 'open' ? '● Open' : '● Closed'}
            </span>
            <span className="text-[10px] text-muted flex items-center gap-1">
              <Clock size={10} /> {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-base font-bold text-main">{post.title}</h3>
        </div>

        {isOwner && (
          <div className="flex gap-1">
            <button
              onClick={handleClose}
              title={post.status === 'open' ? 'Mark as Closed' : 'Reopen'}
              className="p-1.5 rounded-lg text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete"
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {post.description && (
        <p className="text-sm text-muted leading-relaxed">{post.description}</p>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <Link
          to={`/profile/${post.profiles?.username}`}
          className="flex items-center gap-2 text-sm text-muted hover:text-main transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {post.profiles?.username?.[0]?.toUpperCase()}
          </div>
          {post.profiles?.username}
        </Link>

        {!isOwner && post.status === 'open' && (
          <button
            onClick={handleMessage}
            className="text-xs px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg font-semibold transition-colors"
          >
            Express Interest
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CreateCollabModal({ session, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', skills_needed: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    const { error } = await supabase.from('collab_posts').insert({
      user_id: session.user.id,
      ...form
    });
    setLoading(false);
    if (error) { toast.error(error.message); }
    else { toast.success('Collab post created!'); onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface border border-white/10 rounded-2xl w-full max-w-lg p-6 flex flex-col gap-4"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-main">Post a Collab Request</h2>
          <button onClick={onClose} className="text-muted hover:text-main"><X size={20} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">Project Title *</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Looking for React dev for SaaS project"
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-main outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Tell others about your project and what you need..."
              rows={3}
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-main outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">Skills Needed (comma-separated)</label>
            <input
              value={form.skills_needed}
              onChange={e => setForm({ ...form, skills_needed: e.target.value })}
              placeholder="e.g. React, Node.js, PostgreSQL"
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-2.5 text-sm text-main outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-main transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Post Request'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function CollabBoardPage({ session }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  const loadPosts = async () => {
    setLoading(true);
    let query = supabase
      .from('collab_posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data } = await query;
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, [filter]);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'open', label: '● Open' },
    { id: 'closed', label: 'Closed' },
  ];

  return (
    <div className="min-h-screen pt-20 px-4 max-w-5xl mx-auto pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Briefcase size={24} className="text-primary" />
            <h1 className="text-2xl font-bold text-main">Collab Board</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Post Request
          </button>
        </div>
        <p className="text-sm text-muted">Find collaborators for your projects or offer your skills</p>

        <div className="flex gap-2 mt-4">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${filter === f.id ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-main'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <Loader />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No collab posts yet"
          description="Be the first to post a collaboration request!"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map(post => (
            <CollabCard key={post.id} post={post} session={session} onUpdate={loadPosts} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateCollabModal
            session={session}
            onClose={() => setShowCreate(false)}
            onCreated={loadPosts}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
