import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Award, Plus, Trash2, ExternalLink, FileText, Trophy, BookOpen, Upload, X, Link as LinkIcon } from 'lucide-react';
import { SkeletonBox } from '../components/ui/SkeletonLoader';

const TYPE_CONFIG = {
  certificate: { label: 'Certificate', icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  achievement: { label: 'Achievement', icon: Trophy, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
  project: { label: 'Project', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  publication: { label: 'Publication', icon: FileText, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
};

export default function PortfolioPage({ session }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [form, setForm] = useState({ type: 'certificate', title: '', description: '', issued_by: '', issued_at: '', link: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [session]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({ ...form, user_id: session.user.id })
      .select()
      .single();
    if (error) {
      toast.error('Failed to add item');
    } else {
      setItems(prev => [data, ...prev]);
      setForm({ type: 'certificate', title: '', description: '', issued_by: '', issued_at: '', link: '' });
      setShowForm(false);
      toast.success('Portfolio item added!');
    }
    setSubmitting(false);
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item removed');
    }
  };

  const filtered = activeFilter === 'all' ? items : items.filter(i => i.type === activeFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <SkeletonBox key={i} className="h-48" />)}
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
              <div className="h-10 w-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Award size={20} className="text-yellow-400" />
              </div>
              Portfolio Showcase
            </h1>
            <p className="text-muted mt-1">Your certificates, achievements, and publications</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="vibrant-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 self-start"
          >
            <Plus size={16} /> Add Item
          </button>
        </motion.div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'certificate', 'achievement', 'project', 'publication'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                activeFilter === f
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-muted border-border hover:border-border-hover hover:text-main'
              }`}
            >
              {f === 'all' ? 'All' : TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-20 glass-panel rounded-2xl">
            <Award size={64} className="mx-auto mb-4 text-muted opacity-20" />
            <h3 className="text-lg font-semibold text-main mb-1">No items yet</h3>
            <p className="text-muted text-sm">Add your first portfolio item to showcase your achievements.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel rounded-2xl p-5 group hover:border-border-hover transition-all relative"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`p-2.5 rounded-xl border ${cfg.bg} shrink-0`}>
                      <Icon size={18} className={cfg.color} />
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-red-400 transition-all absolute top-4 right-4"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                    <h3 className="text-base font-bold text-main mt-1 pr-6">{item.title}</h3>
                    {item.description && <p className="text-sm text-muted mt-1 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                      {item.issued_by && <span>by {item.issued_by}</span>}
                      {item.issued_at && <span>{new Date(item.issued_at).getFullYear()}</span>}
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline ml-auto">
                          <ExternalLink size={12} /> View
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-color)] border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Portfolio Item</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-muted hover:text-main transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button key={key} type="button" onClick={() => setForm(p => ({ ...p, type: key }))}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                            form.type === key ? `${cfg.bg} ${cfg.color} border-current` : 'bg-surface text-muted border-border hover:border-border-hover'
                          }`}
                        >
                          <Icon size={14} /> {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Title *"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
                />
                <textarea
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  rows={2}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.issued_by} onChange={e => setForm(p => ({ ...p, issued_by: e.target.value }))}
                    placeholder="Issued by"
                    className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
                  />
                  <input
                    type="date" value={form.issued_at} onChange={e => setForm(p => ({ ...p, issued_at: e.target.value }))}
                    className="bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary/50"
                  />
                </div>
                <input
                  type="url" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                  placeholder="Link (optional)"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50"
                />
                <button type="submit" disabled={submitting}
                  className="w-full vibrant-btn py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add to Portfolio'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
