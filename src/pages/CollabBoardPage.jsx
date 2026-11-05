import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Users, Code2, Clock, CheckCircle, Briefcase, MessageSquare, Tag } from 'lucide-react';
import { toast } from '../lib/toast';
import { Link } from 'react-router-dom';
import Loader from '../components/ui/Loader';

import { computeTeamSynergy, getSynergyRationale } from '../lib/skillGraph';
import SkillRadarChart from '../components/ui/SkillRadarChart';

function CollabCard({ post, session, onUpdate, userTechStack }) {
  const isOwner = post.user_id === session?.user?.id;
  const skills = post.skills_needed ? post.skills_needed.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [showSynergyBreakdown, setShowSynergyBreakdown] = useState(false);

  // Compute live mathematical synergy score
  const synergy = computeTeamSynergy({
    requiredSkills: post.skills_needed || '',
    userSkills: userTechStack || 'Full-Stack Web Development',
  });

  const handleClose = async () => {
    const { error } = await supabase
      .from('collab_posts')
      .update({ status: post.status === 'open' ? 'closed' : 'open' })
      .eq('id', post.id);
    if (!error) { toast.success('Status updated!'); onUpdate(); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this collab post?')) return;
    const { error } = await supabase.from('collab_posts').delete().eq('id', post.id);
    if (!error) { toast.success('Post removed!'); onUpdate(); }
    else toast.error(error.message);
  };

  const handleMessage = () => {
    document.dispatchEvent(new CustomEvent('startChat', {
      detail: { userId: post.user_id, username: post.profiles?.username }
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass-panel rounded-2xl p-5 flex flex-col gap-4 transition-colors relative"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={
                post.status === 'open'
                  ? { backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                  : { backgroundColor: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }
              }
            >
              {post.status === 'open' ? '● Open' : '● Closed'}
            </span>
            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Clock size={10} /> {new Date(post.created_at).toLocaleDateString()}
            </span>

            {/* Mathematical Team Synergy Pill */}
            {!isOwner && post.status === 'open' && (
              <button
                type="button"
                onClick={() => setShowSynergyBreakdown(prev => !prev)}
                className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/10 border border-orange-500/40 text-orange-600 dark:text-orange-400 flex items-center gap-1 cursor-pointer transition-transform hover:scale-105"
                title="Click to view AI & Graph Synergy breakdown"
              >
                <span>✨ {synergy.score}% Synergy</span>
                <span className="text-[9px] opacity-75 hidden sm:inline">({synergy.matchLevel})</span>
              </button>
            )}
          </div>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-color)' }}>{post.title}</h3>
        </div>

        {isOwner && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleClose}
              title={post.status === 'open' ? 'Mark as Closed' : 'Reopen'}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.1)'; e.currentTarget.style.color = '#10b981'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete"
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {post.description && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{post.description}</p>
      )}

      {/* Expandable Synergy Rationale & Vector Breakdown */}
      {showSynergyBreakdown && !isOwner && (
        <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-orange-600 dark:text-orange-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <span>🕸️</span> 4D Skill Graph & Synergy
            </span>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400">
              Jaccard Overlap: {synergy.breakdown.directOverlap}%
            </span>
          </div>

          {/* Interactive 4D Radar Chart */}
          <div className="py-2 flex justify-center bg-white/50 dark:bg-stone-900/50 rounded-xl p-2 border border-orange-500/15">
            <SkillRadarChart
              requiredSkills={post.skills_needed || ''}
              candidateSkills={userTechStack || 'Full-Stack Web Development'}
              size={210}
              showLegend={true}
            />
          </div>

          <p className="text-stone-700 dark:text-stone-300 text-xs leading-relaxed">
            {getSynergyRationale({ synergy, projectTitle: post.title })}
          </p>

          {synergy.matchedSkills.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-orange-500/20 text-[10px]">
              <span className="text-stone-500 font-medium">Direct Overlap:</span>
              {synergy.matchedSkills.map((ms, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-semibold">
                  ✓ {ms}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-1 rounded-lg font-medium"
              style={{
                backgroundColor: 'rgba(99,102,241,0.1)',
                color: 'var(--primary-color)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        <Link
          to={`/profile/${post.profiles?.username}`}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-color)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: 'var(--primary-color)' }}
          >
            {post.profiles?.username?.[0]?.toUpperCase()}
          </div>
          {post.profiles?.username}
        </Link>

        {!isOwner && post.status === 'open' && (
          <button
            onClick={handleMessage}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{
              backgroundColor: 'rgba(99,102,241,0.12)',
              color: 'var(--primary-color)',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.12)'; }}
          >
            <MessageSquare size={13} /> Express Interest
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
      ...form,
      status: 'open',
    });
    setLoading(false);
    if (error) { toast.error(error.message); }
    else { toast.success('Collab post created!'); onCreated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl w-full max-w-lg p-6 flex flex-col gap-5"
        style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>Post a Collab Request</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text-color)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Project Title *
            </label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Looking for React dev for AI SaaS project"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Tell others about your project and what you need..."
              rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none transition-colors"
              style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <Tag size={11} className="inline mr-1" />Skills Needed (comma-separated)
            </label>
            <input
              value={form.skills_needed}
              onChange={e => setForm({ ...form, skills_needed: e.target.value })}
              placeholder="e.g. React, Node.js, PostgreSQL, CyberSecurity"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl cursor-pointer transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-color)'; e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--primary-color)' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--primary-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary-color)'; }}
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
  const [userTechStack, setUserTechStack] = useState('');

  // Fetch viewer profile to compute live mathematical synergy scores
  useEffect(() => {
    const fetchUserStack = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('tech_stack')
        .eq('id', session.user.id)
        .single();
      if (data?.tech_stack) setUserTechStack(data.tech_stack);
    };
    fetchUserStack();
  }, [session?.user?.id]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('collab_posts')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('status', filter);

      const { data, error } = await query;
      if (error) {
        // Table may not exist yet or be empty
        console.warn('collab_posts not available yet:', error.message);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (err) {
      console.warn(err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [filter]);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'open', label: '● Open' },
    { id: 'closed', label: 'Closed' },
  ];

  return (
    <div className="min-h-screen pt-20 px-4 max-w-5xl mx-auto pb-12" style={{ color: 'var(--text-color)' }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Briefcase size={24} style={{ color: 'var(--primary-color)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>Collab Board</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
            style={{ backgroundColor: 'var(--primary-color)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary-color)'}
          >
            <Plus size={16} /> Post Request
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Find collaborators for your projects or offer your skills to the community
        </p>

        <div className="flex gap-2 mt-4">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer"
              style={
                filter === f.id
                  ? { backgroundColor: 'var(--primary-color)', color: '#fff', border: '1px solid var(--primary-color)' }
                  : { backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <Loader />
      ) : posts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ border: '2px dashed var(--border-color)' }}
        >
          <Users size={48} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 16 }} />
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
            No collab posts yet
          </h3>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Be the first to post a collaboration request!
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            <Plus size={16} /> Post a Collab Request
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {posts.map(post => (
              <CollabCard
                key={post.id}
                post={post}
                session={session}
                onUpdate={loadPosts}
                userTechStack={userTechStack}
              />
            ))}
          </AnimatePresence>
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
