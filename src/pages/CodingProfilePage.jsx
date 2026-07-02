import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Code2, Star, Plus, Trash2, ExternalLink, Trophy, GitBranch, Target } from 'lucide-react';
import { SkeletonBox, SkeletonText } from '../components/ui/SkeletonLoader';

const PLATFORMS = [
  { key: 'leetcode_url', label: 'LeetCode', icon: '🧩', color: '#FFA116', placeholder: 'https://leetcode.com/username' },
  { key: 'codeforces_url', label: 'Codeforces', icon: '⚡', color: '#1F8ACB', placeholder: 'https://codeforces.com/profile/username' },
  { key: 'github_url', label: 'GitHub', icon: '🐙', color: '#24292e', placeholder: 'https://github.com/username' },
  { key: 'hackerrank_url', label: 'HackerRank', icon: '🟢', color: '#2EC866', placeholder: 'https://hackerrank.com/username' },
  { key: 'codechef_url', label: 'CodeChef', icon: '👨‍🍳', color: '#5B4638', placeholder: 'https://codechef.com/users/username' },
];

function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`text-lg transition-transform ${!readonly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
        >
          {star <= (hover || value) ? '⭐' : '☆'}
        </button>
      ))}
    </div>
  );
}

export default function CodingProfilePage({ session }) {
  const [profile, setProfile] = useState(null);
  const [skillBadges, setSkillBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState(3);
  const [form, setForm] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profileData) {
        setProfile(profileData);
        setForm({
          leetcode_url: profileData.leetcode_url || '',
          codeforces_url: profileData.codeforces_url || '',
          github_url: profileData.github_url || '',
          hackerrank_url: profileData.hackerrank_url || '',
          codechef_url: profileData.codechef_url || '',
        });
      }

      const { data: badges } = await supabase
        .from('skill_badges')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setSkillBadges(badges || []);
      setLoading(false);
    };
    fetchData();
  }, [session]);

  const saveProfiles = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update(form)
      .eq('id', session.user.id);
    if (error) toast.error('Failed to save coding profiles');
    else toast.success('Coding profiles saved!');
    setSaving(false);
  };

  const addSkill = async () => {
    if (!newSkill.trim()) return;
    const { data, error } = await supabase
      .from('skill_badges')
      .insert({ user_id: session.user.id, skill_name: newSkill.trim(), proficiency: newSkillLevel })
      .select()
      .single();
    if (error) toast.error('Failed to add skill');
    else {
      setSkillBadges(prev => [data, ...prev]);
      setNewSkill('');
      setNewSkillLevel(3);
      toast.success(`Added ${data.skill_name}!`);
    }
  };

  const removeSkill = async (id) => {
    const { error } = await supabase.from('skill_badges').delete().eq('id', id);
    if (!error) setSkillBadges(prev => prev.filter(s => s.id !== id));
  };

  const updateSkillLevel = async (id, proficiency) => {
    await supabase.from('skill_badges').update({ proficiency }).eq('id', id);
    setSkillBadges(prev => prev.map(s => s.id === id ? { ...s, proficiency } : s));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {[1,2,3].map(i => <SkeletonBox key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Code2 size={20} className="text-primary" />
            </div>
            Coding Profiles
          </h1>
          <p className="text-muted mt-1">Connect your competitive programming and coding accounts</p>
        </motion.div>

        {/* Platform URLs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Target size={18} className="text-primary" /> Platform Links & Stats
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {PLATFORMS.map(p => (
                <div key={p.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      <span className="text-xl">{p.icon}</span>
                      <span className="text-sm font-medium text-muted">{p.label}</span>
                    </div>
                    <input
                      type="url"
                      value={form[p.key] || ''}
                      onChange={e => setForm(prev => ({ ...prev, [p.key]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    {form[p.key] && (
                      <a href={form[p.key]} target="_blank" rel="noreferrer"
                        className="p-2 text-muted hover:text-primary transition-colors"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={saveProfiles}
                disabled={saving}
                className="mt-6 vibrant-btn px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profiles'}
              </button>
            </div>
            
            {/* Mock Stats Display */}
            <div className="bg-surface/50 border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-main mb-4 flex items-center gap-2">
                <GitBranch size={16} className="text-primary" /> Live Statistics
              </h3>
              
              <div className="space-y-4">
                {form.leetcode_url ? (
                  <div className="bg-background rounded-lg p-3 border border-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🧩</span>
                      <span className="text-sm font-medium">LeetCode</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted font-mono">
                      <span>Problems: <strong className="text-main">342</strong></span>
                      <span className="text-green-400">Easy: 150</span>
                      <span className="text-yellow-400">Med: 152</span>
                      <span className="text-red-400">Hard: 40</span>
                    </div>
                  </div>
                ) : null}
                
                {form.github_url ? (
                  <div className="bg-background rounded-lg p-3 border border-border flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🐙</span>
                      <span className="text-sm font-medium">GitHub</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted font-mono">
                      <span>Repos: <strong className="text-main">45</strong></span>
                      <span>Stars: <strong className="text-main">128</strong></span>
                      <span>Contributions: <strong className="text-main">1,024</strong></span>
                    </div>
                  </div>
                ) : null}
                
                {!form.leetcode_url && !form.github_url && (
                  <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-lg">
                    Add LeetCode or GitHub links to see your stats here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Skill Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Star size={18} className="text-primary" /> Skill Badges
          </h2>

          {/* Add Skill */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-surface/50 rounded-xl border border-border">
            <input
              type="text"
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
              placeholder="Skill name (e.g. React, Python, Java...)"
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-main placeholder:text-muted/50 focus:outline-none focus:border-primary/50 transition-colors"
            />
            <div className="flex items-center gap-3">
              <StarRating value={newSkillLevel} onChange={setNewSkillLevel} />
              <button
                onClick={addSkill}
                className="vibrant-btn px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shrink-0"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          {/* Skill Grid */}
          {skillBadges.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Trophy size={48} className="mx-auto mb-3 opacity-20" />
              <p>No skills added yet. Add your first skill above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skillBadges.map(badge => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between p-4 bg-surface rounded-xl border border-border group hover:border-border-hover transition-colors"
                >
                  <div>
                    <p className="font-semibold text-main text-sm">{badge.skill_name}</p>
                    <StarRating
                      value={badge.proficiency}
                      onChange={(val) => updateSkillLevel(badge.id, val)}
                    />
                  </div>
                  <button
                    onClick={() => removeSkill(badge.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
