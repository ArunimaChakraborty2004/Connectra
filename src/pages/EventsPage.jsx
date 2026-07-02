import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Calendar, Plus, ExternalLink, MapPin, Globe, Zap, Users, BookOpen, Coffee, X, Filter } from 'lucide-react';
import { CardSkeleton } from '../components/ui/SkeletonLoader';

const TYPE_CONFIG = {
  hackathon: { label: 'Hackathon', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', emoji: '⚡' },
  contest: { label: 'Contest', icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', emoji: '🏆' },
  meetup: { label: 'Meetup', icon: Coffee, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', emoji: '☕' },
  webinar: { label: 'Webinar', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', emoji: '🎙️' },
  conference: { label: 'Conference', icon: Users, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20', emoji: '🎤' },
  other: { label: 'Other', icon: Calendar, color: 'text-muted', bg: 'bg-surface border-border', emoji: '📅' },
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isUpcoming(dateStr) {
  return new Date(dateStr) > new Date();
}

export default function EventsPage({ session }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('upcoming');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({ title: '', description: '', type: 'hackathon', start_date: '', end_date: '', location: '', is_online: true, link: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*, profiles:creator_id(username)')
      .order('start_date', { ascending: true });
    setEvents(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from('events')
      .insert({ ...form, creator_id: session.user.id })
      .select('*, profiles:creator_id(username)')
      .single();
    if (error) toast.error('Failed to create event');
    else {
      setEvents(prev => [...prev, data].sort((a, b) => new Date(a.start_date) - new Date(b.start_date)));
      setShowForm(false);
      setForm({ title: '', description: '', type: 'hackathon', start_date: '', end_date: '', location: '', is_online: true, link: '' });
      toast.success('Event created!');
    }
    setSubmitting(false);
  };

  const filtered = events.filter(e => {
    const matchTime = filter === 'all' ? true : filter === 'upcoming' ? isUpcoming(e.start_date) : !isUpcoming(e.start_date);
    const matchType = typeFilter === 'all' ? true : e.type === typeFilter;
    return matchTime && matchType;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
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
              <div className="h-10 w-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                <Calendar size={20} className="text-blue-400" />
              </div>
              Events
            </h1>
            <p className="text-muted mt-1">Hackathons, contests, meetups & webinars</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="vibrant-btn px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 self-start">
            <Plus size={16} /> Create Event
          </button>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {['upcoming', 'past', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border capitalize ${
                  filter === f ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-border hover:border-border-hover'
                }`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                typeFilter === 'all' ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-border'
              }`}>All Types</button>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setTypeFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  typeFilter === key ? `${cfg.bg} ${cfg.color}` : 'bg-surface text-muted border-border'
                }`}>
                {cfg.emoji} {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-2xl">
            <Calendar size={64} className="mx-auto mb-4 text-muted opacity-20" />
            <h3 className="text-lg font-semibold">No events found</h3>
            <p className="text-muted text-sm mt-1">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((event, i) => {
              const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.other;
              const Icon = cfg.icon;
              const upcoming = isUpcoming(event.start_date);
              return (
                <motion.div key={event.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`glass-panel rounded-2xl p-5 hover:border-border-hover transition-all ${!upcoming ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className={`p-2 rounded-xl border ${cfg.bg}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex items-center gap-2">
                      {upcoming && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-400/10 text-green-400 border border-green-400/20 rounded-full">
                          Upcoming
                        </span>
                      )}
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-main text-base mb-1">{event.title}</h3>
                  {event.description && <p className="text-sm text-muted line-clamp-2 mb-3">{event.description}</p>}
                  <div className="space-y-1.5 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} />
                      <span>{formatDate(event.start_date)}{event.end_date ? ` → ${formatDate(event.end_date)}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.is_online ? <Globe size={12} /> : <MapPin size={12} />}
                      <span>{event.is_online ? 'Online' : (event.location || 'Location TBD')}</span>
                    </div>
                  </div>
                  {event.link && (
                    <a href={event.link} target="_blank" rel="noreferrer"
                      className="mt-4 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors">
                      <ExternalLink size={14} /> Register / Learn More
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 overflow-y-auto py-8">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-color)] border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl my-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Event</h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-muted hover:text-main transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Event title *"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description" rows={2}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 resize-none" />
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary/50">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Start Date *</label>
                    <input required type="datetime-local" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-primary/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">End Date</label>
                    <input type="datetime-local" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-main focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_online} onChange={e => setForm(p => ({ ...p, is_online: e.target.checked }))}
                      className="w-4 h-4 accent-purple-500" />
                    <span className="text-sm text-muted">Online event</span>
                  </label>
                  {!form.is_online && (
                    <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                      placeholder="Location"
                      className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
                  )}
                </div>
                <input type="url" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                  placeholder="Registration / Info Link"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50" />
                <button type="submit" disabled={submitting}
                  className="w-full vibrant-btn py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Event'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
