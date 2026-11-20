import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Loader2, XCircle, Code2, Globe
} from 'lucide-react';
import { toast } from '../lib/toast';

export default function OnboardingModal({ session, onComplete }) {
  const meta = session?.user?.user_metadata || {};
  const ghUsername = meta.user_name || meta.preferred_username || '';
  const initialFullName = meta.full_name || meta.name || '';
  const initialAvatar = meta.avatar_url || '';

  const [formData, setFormData] = useState({
    username: ghUsername || session?.user?.email?.split('@')[0] || '',
    full_name: initialFullName,
    bio: '',
    tech_stack: '',
  });

  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: '',
  });

  const [saving, setSaving] = useState(false);

  // Validate handle in real-time
  useEffect(() => {
    const raw = formData.username;
    if (!raw || !raw.trim()) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }

    const clean = raw.trim().toLowerCase().replace(/\s+/g, '_');
    if (clean.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: 'Handle must be at least 3 chars.' });
      return;
    }

    let isMounted = true;
    setUsernameStatus({ checking: true, available: null, message: '' });

    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .neq('id', session.user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (data) {
          setUsernameStatus({ checking: false, available: false, message: `@${clean} is already taken.` });
        } else {
          setUsernameStatus({ checking: false, available: true, message: `@${clean} is available!` });
        }
      } catch {
        if (isMounted) setUsernameStatus({ checking: false, available: true, message: '' });
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.username, session.user.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (usernameStatus.available === false) {
      toast.error('Please choose an available username handle.');
      return;
    }

    setSaving(true);
    const cleanUsername = formData.username.trim().toLowerCase().replace(/\s+/g, '_');
    const ghUrl = ghUsername ? `https://github.com/${ghUsername}` : null;

    try {
      const updates = {
        id: session.user.id,
        username: cleanUsername,
        full_name: formData.full_name.trim() || cleanUsername,
        bio: formData.bio.trim() || 'Software Engineer on Connectra',
        tech_stack: formData.tech_stack.trim() || 'JavaScript, React, Node.js',
        github_url: ghUrl,
        avatar_url: initialAvatar || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      if (ghUrl) {
        localStorage.setItem(`github_verified_${session.user.id}`, ghUrl);
      }
      localStorage.setItem(`connectra_onboarded_${session.user.id}`, 'true');

      toast.success(`Welcome to Connectra, @${cleanUsername}! 🚀`);
      onComplete?.(updates);
    } catch (err) {
      toast.error(err.message || 'Failed to complete profile setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#faf6f0] border-2 border-[#eeddd0] rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-[#1c130d] via-[#2e1708] to-[#1c130d] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-orange-500/20 to-transparent pointer-events-none" />
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white p-2 shadow-lg flex items-center justify-center border-2 border-[#ea580c]">
            {initialAvatar ? (
              <img src={initialAvatar} alt="GitHub Avatar" className="w-full h-full rounded-xl object-cover" />
            ) : (
              <Code2 className="text-[#ea580c]" size={28} />
            )}
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#ea580c] bg-orange-950/60 px-3 py-1 rounded-full border border-orange-500/30">
            Official GitHub Account Connected
          </span>
          <h2 className="text-xl sm:text-2xl font-black mt-2 font-serif text-[#faf6f0]">
            Complete Your Developer Identity
          </h2>
          <p className="text-xs text-[#d4b8a8] mt-1 max-w-md mx-auto">
            You authorized as <strong className="text-white">@{ghUsername || 'developer'}</strong>. Confirm your handle and profile details before entering the workspace.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Handle */}
          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className="text-xs font-bold text-[#1c130d]">Connectra Handle *</label>
              {usernameStatus.checking && (
                <span className="text-[11px] text-[#ea580c] font-medium flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Verifying...
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a5d3b] font-bold text-sm">@</span>
              <input
                type="text"
                required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className={`w-full py-3 pl-9 pr-10 rounded-2xl bg-white border-2 text-sm text-[#1c130d] font-mono font-bold outline-none transition-all ${
                  usernameStatus.checking
                    ? 'border-amber-400'
                    : usernameStatus.available === false
                    ? 'border-rose-500 bg-rose-50/40'
                    : usernameStatus.available === true
                    ? 'border-emerald-600 bg-emerald-50/40'
                    : 'border-[#eeddd0] focus:border-[#ea580c]'
                }`}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {usernameStatus.checking ? (
                  <Loader2 size={15} className="text-[#ea580c] animate-spin" />
                ) : usernameStatus.available === false ? (
                  <XCircle size={15} className="text-rose-500" />
                ) : usernameStatus.available === true ? (
                  <CheckCircle2 size={15} className="text-emerald-600" />
                ) : null}
              </div>
            </div>
            {usernameStatus.message && (
              <p className={`text-[11px] font-semibold mt-1 ml-1 ${usernameStatus.available === false ? 'text-rose-600' : 'text-emerald-700'}`}>
                {usernameStatus.message}
              </p>
            )}
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-[#1c130d] mb-1.5 ml-1">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="e.g. John Doe"
              className="w-full py-2.5 px-4 rounded-2xl bg-white border-2 border-[#eeddd0] text-sm text-[#1c130d] font-semibold outline-none focus:border-[#ea580c]"
            />
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs font-bold text-[#1c130d] mb-1.5 ml-1">Primary Tech Stack</label>
            <input
              type="text"
              value={formData.tech_stack}
              onChange={e => setFormData({ ...formData, tech_stack: e.target.value })}
              placeholder="React, TypeScript, Python, Node.js"
              className="w-full py-2.5 px-4 rounded-2xl bg-white border-2 border-[#eeddd0] text-sm text-[#1c130d] outline-none focus:border-[#ea580c]"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-[#1c130d] mb-1.5 ml-1">Developer Bio</label>
            <textarea
              rows={2}
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              placeholder="What are you building or looking to collaborate on?"
              className="w-full py-2.5 px-4 rounded-2xl bg-white border-2 border-[#eeddd0] text-sm text-[#1c130d] outline-none focus:border-[#ea580c] resize-none"
            />
          </div>

          {/* Submit */}
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={saving || usernameStatus.checking || usernameStatus.available === false}
            className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <>
                <span>Enter Connectra Workspace</span>
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
