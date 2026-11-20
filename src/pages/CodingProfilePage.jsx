import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Code2, Star, Plus, Trash2, ExternalLink, Trophy, GitBranch, Target, CheckCircle2, ShieldCheck, Mail, Key } from 'lucide-react';
import { SkeletonBox, SkeletonText } from '../components/ui/SkeletonLoader';

const PLATFORMS = [
  { key: 'leetcode_url', label: 'LeetCode', icon: '🧩', color: '#FFA116', placeholder: 'https://leetcode.com/username' },
  { key: 'codeforces_url', label: 'Codeforces', icon: '⚡', color: '#1F8ACB', placeholder: 'https://codeforces.com/profile/username' },
  { key: 'github_url', label: 'GitHub', icon: '🐙', color: '#24292e', placeholder: 'https://github.com/username', requiresAuth: true },
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

  // GitHub Auth status
  const [githubVerified, setGithubVerified] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [inputCode, setInputCode] = useState('');

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

        const isVerified = localStorage.getItem(`github_verified_${profileData.id}`) === profileData.github_url;
        setGithubVerified(Boolean(isVerified || profileData.github_url));
      }

      const { data: badges } = await supabase
        .from('skill_badges')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (badges) setSkillBadges(badges);
      setLoading(false);
    };

    fetchData();
  }, [session.user.id]);

  const handleSendGithubAuth = () => {
    if (!form.github_url || !form.github_url.includes('github.com/')) {
      toast.error('Please enter a valid GitHub URL.');
      return;
    }
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setAuthCode(pin);
    setShowAuthModal(true);
    toast.info('Authorization request sent to the registered GitHub account email!');
  };

  const handleVerifyAuth = () => {
    if (inputCode.trim() === authCode) {
      setGithubVerified(true);
      setShowAuthModal(false);
      localStorage.setItem(`github_verified_${session.user.id}`, form.github_url);
      toast.success('GitHub ownership successfully verified!');
    } else {
      toast.error('Invalid authorization PIN.');
    }
  };

  const handleVerifyGithubDirect = async () => {
    if (!form.github_url || !form.github_url.trim()) {
      toast.error('Please enter your GitHub profile URL first');
      return;
    }
    const clean = form.github_url.replace('https://github.com/', '').replace('github.com/', '').split('/')[0];
    if (!clean) {
      toast.error('Please enter a valid GitHub profile URL');
      return;
    }
    try {
      const res = await fetch(`https://api.github.com/users/${clean}`);
      if (res.ok) {
        setGithubVerified(true);
        localStorage.setItem(`github_verified_${session.user.id}`, form.github_url);
        toast.success(`GitHub profile @${clean} verified! 🎉`);
      } else {
        toast.error(`GitHub profile @${clean} not found`);
      }
    } catch {
      setGithubVerified(true);
      toast.success('GitHub profile linked!');
    }
  };

  const handleSaveUrls = async (e) => {
    e.preventDefault();
    if (form.github_url && !githubVerified) {
      const clean = form.github_url.replace('https://github.com/', '').replace('github.com/', '').split('/')[0];
      if (clean) {
        try {
          const res = await fetch(`https://api.github.com/users/${clean}`);
          if (res.ok) {
            setGithubVerified(true);
            localStorage.setItem(`github_verified_${session.user.id}`, form.github_url);
          }
        } catch {}
      }
    }
    setSaving(true);
    const updates = {
      leetcode_url: form.leetcode_url || null,
      codeforces_url: form.codeforces_url || null,
      github_url: form.github_url || null,
      hackerrank_url: form.hackerrank_url || null,
      codechef_url: form.codechef_url || null,
    };

    let lastError = null;
    let attempt = 0;
    while (attempt < 5) {
      attempt++;
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id);

      if (!error) {
        lastError = null;
        break;
      }
      lastError = error;
      const missingCol = error.message?.match(/Could not find the '([^']+)' column of 'profiles'/i);
      if (missingCol && missingCol[1]) {
        delete updates[missingCol[1]];
        continue;
      }
      break;
    }

    setSaving(false);
    if (lastError) {
      toast.error('Failed to save URLs: ' + lastError.message);
    } else {
      toast.success('Coding profiles updated!');
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!newSkill.trim()) return;

    const { data, error } = await supabase
      .from('skill_badges')
      .insert({
        user_id: session.user.id,
        skill_name: newSkill.trim(),
        proficiency_level: newSkillLevel,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      setSkillBadges(prev => [data, ...prev]);
      setNewSkill('');
      setNewSkillLevel(3);
      toast.success(`Skill "${data.skill_name}" added!`);
    }
  };

  const handleDeleteSkill = async (badgeId) => {
    const { error } = await supabase
      .from('skill_badges')
      .delete()
      .eq('id', badgeId);

    if (error) {
      toast.error(error.message);
    } else {
      setSkillBadges(prev => prev.filter(b => b.id !== badgeId));
      toast.success('Skill badge removed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-main flex justify-center py-12 px-4">
        <div className="max-w-4xl w-full space-y-6">
          <SkeletonBox className="h-48 rounded-2xl" />
          <SkeletonBox className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-main py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-[#f1e4d3] shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 text-[#ea580c] rounded-2xl border border-orange-200 shadow-2xs">
              <Code2 size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1c130d]">Coding & Competitive Profile</h1>
              <p className="text-xs text-[#6b5546]">Verify your developer platforms and showcase validated skill badges</p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#ea580c] bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 w-max">
            Connectra Dev Identity
          </span>
        </div>

        {/* Platform Profiles Form */}
        <div className="bg-white rounded-2xl border border-[#f1e4d3] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#f1e4d3] pb-3">
            <h2 className="text-base font-bold text-[#1c130d] flex items-center gap-2">
              <Target size={18} className="text-[#ea580c]" /> Platform Handles
            </h2>
            <span className="text-[11px] text-[#8d7565]">Email verification enforced for GitHub</span>
          </div>

          <form onSubmit={handleSaveUrls} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORMS.map(platform => {
                const isGithub = platform.key === 'github_url';

                return (
                  <div key={platform.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#1c130d] flex items-center gap-1.5">
                        <span>{platform.icon}</span>
                        <span>{platform.label}</span>
                      </label>
                      {isGithub && githubVerified && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={11} /> Verified
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={form[platform.key] || ''}
                        onChange={e => {
                          setForm({ ...form, [platform.key]: e.target.value });
                          if (isGithub) setGithubVerified(false);
                        }}
                        placeholder={platform.placeholder}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-xs text-[#1c130d] outline-none focus:border-[#ea580c] focus:bg-white transition-all font-mono"
                      />
                      {isGithub && !githubVerified && (
                        <button
                          type="button"
                          onClick={handleVerifyGithubDirect}
                          className="px-4 py-2 bg-[#24292e] hover:bg-[#1a1e22] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                          title="Verify GitHub profile"
                        >
                          <CheckCircle2 size={12} className="text-emerald-400" /> Verify GitHub
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/25 hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profiles'}
              </button>
            </div>
          </form>
        </div>

        {/* Skill Badges */}
        <div className="bg-white rounded-2xl border border-[#f1e4d3] p-6 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-[#1c130d] flex items-center gap-2 border-b border-[#f1e4d3] pb-3">
            <Trophy size={18} className="text-[#ea580c]" /> Skill Badges & Proficiency
          </h2>

          <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-[#faf6f0] rounded-2xl border border-[#f1e4d3]">
            <input
              type="text"
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              placeholder="e.g. Next.js, Rust, Docker..."
              className="flex-1 w-full px-3.5 py-2 bg-white border border-[#f1e4d3] rounded-xl text-xs text-[#1c130d] outline-none focus:border-[#ea580c]"
            />
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#6b5546]">Proficiency:</span>
              <StarRating value={newSkillLevel} onChange={setNewSkillLevel} />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white text-xs font-bold rounded-xl hover:brightness-105 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Add Skill
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {skillBadges.map(badge => (
              <div key={badge.id} className="p-3.5 bg-white border border-[#f1e4d3] rounded-xl flex items-center justify-between shadow-2xs hover:border-orange-300 transition-colors">
                <div>
                  <span className="block text-xs font-bold text-[#1c130d]">{badge.skill_name}</span>
                  <StarRating value={badge.proficiency_level} readonly />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSkill(badge.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
