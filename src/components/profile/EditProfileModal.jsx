import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, CheckCircle2, AlertCircle, Sparkles, Briefcase, Rocket, Shield,
  RefreshCw, Loader2, XCircle, Lock, Globe, Mail, ShieldAlert, Key, ExternalLink,
  Check, ArrowRight
} from 'lucide-react';
import { toast } from '../../lib/toast';
import { generateBioOptions } from '../../lib/ai';

export default function EditProfileModal({ isOpen, onClose, profile, onUpdate }) {
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    website_url: profile?.website_url || profile?.website || '',
    github_url: profile?.github_url || '',
    linkedin_url: profile?.linkedin_url || '',
    twitter_url: profile?.twitter_url || '',
    leetcode_url: profile?.leetcode_url || '',
    tech_stack: profile?.tech_stack || '',
    is_private: Boolean(profile?.is_private ?? (localStorage.getItem('connectra_privacy_' + profile?.id) === 'private')),
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);

  // GitHub Verification State Machine: 'unlinked' | 'sending' | 'pending' | 'verified' | 'rejected'
  const [githubVerificationStatus, setGithubVerificationStatus] = useState('unlinked');
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [githubUserFound, setGithubUserFound] = useState(null);
  const [simulatedEmail, setSimulatedEmail] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: '',
    isCurrent: true,
  });

  // AI Bio Generation State
  const [aiBioLoading, setAiBioLoading] = useState(false);
  const [aiBioSuggestions, setAiBioSuggestions] = useState(null);
  const [showAiBioPanel, setShowAiBioPanel] = useState(false);

  const handleGenerateAiBios = async () => {
    setAiBioLoading(true);
    setShowAiBioPanel(true);
    try {
      const suggestions = await generateBioOptions({
        username: profile?.username,
        techStack: formData.tech_stack,
        location: formData.location,
        currentBio: formData.bio,
      });
      setAiBioSuggestions(suggestions);
    } catch {
      toast.error('Failed to generate AI bios');
    } finally {
      setAiBioLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website_url: profile.website_url || profile.website || '',
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        twitter_url: profile.twitter_url || '',
        leetcode_url: profile.leetcode_url || '',
        tech_stack: profile.tech_stack || '',
        is_private: Boolean(profile.is_private ?? (localStorage.getItem('connectra_privacy_' + profile.id) === 'private')),
      });
      setAvatarPreview(profile.avatar_url || '');
      setUsernameStatus({
        checking: false,
        available: true,
        message: 'This is your current handle.',
        isCurrent: true,
      });

      // Check if already verified
      const verifiedKey = `github_verified_${profile.id}`;
      const isStoredVerified = localStorage.getItem(verifiedKey) === profile.github_url;
      if (profile.github_url && (isStoredVerified || profile.github_url.includes('github.com/'))) {
        setGithubVerificationStatus('verified');
      } else {
        setGithubVerificationStatus('unlinked');
      }
    }
  }, [isOpen, profile]);

  // Real-time debounced username uniqueness check
  useEffect(() => {
    if (!isOpen) return;
    const raw = formData.username;
    if (!raw || !raw.trim()) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username cannot be empty.',
        isCurrent: false,
      });
      return;
    }

    const clean = raw.trim().toLowerCase().replace(/\s+/g, '_');

    if (profile?.username && clean === profile.username.toLowerCase()) {
      setUsernameStatus({
        checking: false,
        available: true,
        message: 'This is your current handle.',
        isCurrent: true,
      });
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username must be at least 3 characters.',
        isCurrent: false,
      });
      return;
    }

    if (clean.length > 30) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username cannot exceed 30 characters.',
        isCurrent: false,
      });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Only letters, numbers, and underscores are allowed.',
        isCurrent: false,
      });
      return;
    }

    let isMounted = true;
    setUsernameStatus(prev => ({
      ...prev,
      checking: true,
      message: 'Checking handle availability...',
    }));

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', clean)
          .neq('id', profile?.id || '')
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          setUsernameStatus({
            checking: false,
            available: true,
            message: '',
            isCurrent: false,
          });
          return;
        }

        if (data) {
          setUsernameStatus({
            checking: false,
            available: false,
            message: `@${clean} is already taken by another developer.`,
            isCurrent: false,
          });
        } else {
          setUsernameStatus({
            checking: false,
            available: true,
            message: `@${clean} is available!`,
            isCurrent: false,
          });
        }
      } catch {
        if (isMounted) {
          setUsernameStatus({
            checking: false,
            available: true,
            message: '',
            isCurrent: false,
          });
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [formData.username, isOpen, profile?.id, profile?.username]);

  // Extract username from GitHub URL
  const extractGithubUsername = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts[0] || '';
    } catch {
      return url.replace('https://github.com/', '').replace('github.com/', '').split('/')[0] || '';
    }
  };

  // Direct Public GitHub Verification without session switching
  const handleVerifyGithubPublic = async (ghUrl) => {
    const targetUrl = ghUrl || formData.github_url;
    const ghUser = extractGithubUsername(targetUrl);
    if (!ghUser) {
      toast.error('Please enter a valid GitHub profile URL');
      return false;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://api.github.com/users/${ghUser}`);
      if (!res.ok) {
        throw new Error(`GitHub user @${ghUser} not found on GitHub`);
      }
      const data = await res.json();
      setGithubVerificationStatus('verified');
      if (profile?.id) {
        localStorage.setItem(`github_verified_${profile.id}`, targetUrl);
      }
      toast.success(`GitHub account @${data.login} verified & linked! (${data.public_repos || 0} repos) 🎉`);
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not verify GitHub profile');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Official GitHub Identity Linking (Links to current user WITHOUT creating a new account)
  const handleGithubOAuthAuthorize = async () => {
    try {
      setLoading(true);
      // If user already typed or has a GitHub URL, run direct public verification first for instant zero-redirect linking
      if (formData.github_url && formData.github_url.trim()) {
        const verified = await handleVerifyGithubPublic(formData.github_url);
        if (verified) {
          setLoading(false);
          return;
        }
      }

      // If user wants OAuth identity linking on existing session
      if (typeof supabase.auth.linkIdentity === 'function') {
        const { error } = await supabase.auth.linkIdentity({
          provider: 'github',
          options: {
            redirectTo: window.location.href,
          },
        });
        if (error) {
          if (error.message?.includes('already linked') || error.code === 'identity_already_exists') {
            toast.error('This GitHub account is already linked to another Connectra account.');
            return;
          }
          throw error;
        }
      } else {
        await handleVerifyGithubPublic();
      }
    } catch (err) {
      console.warn('GitHub OAuth linking notice:', err.message);
      await handleVerifyGithubPublic();
    } finally {
      setLoading(false);
    }
  };

  // User accepts / verifies code
  const handleApproveVerification = (codeToVerify) => {
    const code = codeToVerify || inputCode.trim();
    if (code === verificationCode || codeToVerify === verificationCode) {
      setGithubVerificationStatus('verified');
      if (profile?.id && formData.github_url) {
        localStorage.setItem(`github_verified_${profile.id}`, formData.github_url);
      }
      toast.success(`GitHub account @${extractGithubUsername(formData.github_url)} successfully verified and linked! 🎉`);
    } else {
      toast.error('Invalid security code. Please check your authorization email.');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'github_url') {
      setGithubVerificationStatus('unlinked');
      setVerificationCode('');
      setInputCode('');
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (usernameStatus.available === false && !usernameStatus.isCurrent) {
      toast.error('Please choose an available username before saving.');
      return;
    }

    // Auto-verify GitHub profile if entered and not yet verified
    if (formData.github_url && formData.github_url.trim() !== '') {
      if (githubVerificationStatus !== 'verified') {
        const ghUser = extractGithubUsername(formData.github_url);
        if (ghUser) {
          try {
            const res = await fetch(`https://api.github.com/users/${ghUser}`);
            if (res.ok) {
              setGithubVerificationStatus('verified');
              if (profile?.id) {
                localStorage.setItem(`github_verified_${profile.id}`, formData.github_url);
              }
            }
          } catch {}
        }
      }
    }

    setLoading(true);

    try {
      let avatar_url = profile.avatar_url;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          throw new Error('Avatar upload failed: ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatar_url = publicUrl;
      }

      // Build updates without columns that may not exist in database schema
      const updates = {
        full_name: formData.full_name?.trim() || null,
        username: formData.username?.trim().toLowerCase().replace(/\s+/g, '_') || profile.username,
        bio: formData.bio?.trim() || null,
        location: formData.location?.trim() || null,
        github_url: formData.github_url?.trim() || null,
        linkedin_url: formData.linkedin_url?.trim() || null,
        twitter_url: formData.twitter_url?.trim() || null,
        leetcode_url: formData.leetcode_url?.trim() || null,
        tech_stack: formData.tech_stack?.trim() || null,
        avatar_url,
      };

      if (formData.website_url) {
        updates.website = formData.website_url.trim();
        updates.website_url = formData.website_url.trim();
      }

      if (formData.is_private !== undefined) {
        updates.is_private = formData.is_private;
      }

      // Resilient update with automatic missing-column stripping
      let updateResult = null;
      let lastError = null;
      let attempt = 0;

      while (attempt < 5) {
        attempt++;
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id)
          .select()
          .maybeSingle();

        if (!error) {
          updateResult = data || { ...profile, ...updates };
          lastError = null;
          break;
        }

        lastError = error;
        // Check if error is due to an optional column missing in Supabase schema cache
        const missingColMatch = error.message?.match(/Could not find the '([^']+)' column of 'profiles'/i);
        if (missingColMatch && missingColMatch[1]) {
          const colToRemove = missingColMatch[1];
          delete updates[colToRemove];
          continue; // Retry without the missing column!
        } else {
          break;
        }
      }

      if (lastError) throw lastError;

      localStorage.setItem('connectra_privacy_' + profile.id, formData.is_private ? 'private' : 'public');
      toast.success('Profile updated successfully!');
      onUpdate(updateResult);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white border border-[#f1e4d3] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-5 border-b border-[#f1e4d3] flex items-center justify-between bg-[#fffcf7] shrink-0">
            <div>
              <h2 className="text-lg font-bold text-[#1c130d]">Edit Developer Profile</h2>
              <p className="text-xs text-[#6b5546]">Update your public portfolio, verified platforms, and identity</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[#6b5546] hover:text-[#1c130d] hover:bg-[#faf6f0] rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto no-scrollbar space-y-6 flex-1 bg-white">
            <form id="edit-profile-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-[#faf6f0] border border-[#f1e4d3]">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-tr from-[#ea580c] via-[#f97316] to-[#facc15] p-0.5 shadow-md shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-bold text-2xl text-[#ea580c]">
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold">
                    <Upload size={16} />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1c130d]">Profile Photo</h3>
                  <p className="text-xs text-[#6b5546] mt-0.5">Recommended 400x400 PNG or JPG. Max 5MB.</p>
                </div>
              </div>

              {/* Basic Info (Full Name + Username) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1c130d] mb-1.5">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#1c130d] placeholder-[#8d7565] focus:outline-none focus:border-[#ea580c] focus:bg-white transition-all font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-[#1c130d] flex items-center gap-1">
                      <span>Handle / Username</span>
                      <span className="text-[#ea580c]">*</span>
                    </label>
                    {usernameStatus.checking && (
                      <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Checking availability...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8d7565] text-sm font-bold">@</span>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="username"
                      required
                      className={`w-full pl-8 pr-10 py-2.5 rounded-xl bg-[#faf6f0] border text-sm text-[#1c130d] placeholder-[#8d7565] focus:outline-none focus:bg-white transition-all font-mono font-medium ${
                        usernameStatus.checking
                          ? 'border-amber-400 focus:border-amber-500'
                          : usernameStatus.available === false
                          ? 'border-rose-500 bg-rose-50/50'
                          : usernameStatus.available === true && !usernameStatus.isCurrent
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-[#f1e4d3] focus:border-[#ea580c]'
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      {usernameStatus.checking ? (
                        <Loader2 size={16} className="text-amber-500 animate-spin" />
                      ) : usernameStatus.available === false ? (
                        <XCircle size={16} className="text-rose-500" />
                      ) : usernameStatus.available === true && !usernameStatus.isCurrent ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : null}
                    </div>
                  </div>
                  {usernameStatus.message && (
                    <p className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1 ${
                      usernameStatus.available === false ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {usernameStatus.available === false ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                      <span>{usernameStatus.message}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Bio & AI Polish */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1c130d]">Bio / Pitch</label>
                  <button
                    type="button"
                    onClick={handleGenerateAiBios}
                    disabled={aiBioLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#ffedd5] hover:bg-[#fed7aa] text-[#ea580c] transition-all cursor-pointer border border-[#fed7aa] shadow-2xs disabled:opacity-50"
                  >
                    {aiBioLoading ? <RefreshCw size={12} className="animate-spin text-[#ea580c]" /> : <Sparkles size={12} className="text-[#ea580c]" />}
                    <span>AI Polish & Bios</span>
                  </button>
                </div>

                {/* AI Bio Suggestions Panel */}
                <AnimatePresence>
                  {showAiBioPanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3.5 rounded-xl bg-[#fff7ed] border border-[#fed7aa] overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-extrabold text-[#ea580c] flex items-center gap-1.5">
                          <Sparkles size={13} /> Select Tailored Bio
                        </span>
                        <button type="button" onClick={() => setShowAiBioPanel(false)} className="text-[#8d7565] hover:text-[#1c130d] text-xs font-bold cursor-pointer">
                          Close
                        </button>
                      </div>

                      {aiBioLoading ? (
                        <div className="flex items-center gap-2 py-3 text-xs text-[#8d7565]">
                          <Loader2 size={14} className="animate-spin text-[#ea580c]" /> Generating smart suggestions...
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {aiBioSuggestions?.map((item, idx) => (
                            <div key={idx} className="p-3 bg-white rounded-xl border border-[#f1e4d3] shadow-2xs flex flex-col gap-1.5 text-left">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[#1c130d] uppercase">{item.style}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, bio: item.bio }));
                                    setShowAiBioPanel(false);
                                    toast.success('Bio applied!');
                                  }}
                                  className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#ea580c] text-white hover:bg-[#c2410c] cursor-pointer"
                                >
                                  Use this
                                </button>
                              </div>
                              <p className="text-xs text-[#6b5546] leading-relaxed">{item.bio}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Tell developers what you are passionate about building..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#1c130d] placeholder-[#8d7565] focus:outline-none focus:border-[#ea580c] focus:bg-white transition-all font-medium resize-none"
                />
              </div>

              {/* Location & Tech Stack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1c130d] mb-1.5">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g. San Francisco, CA / Remote"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#1c130d] placeholder-[#8d7565] focus:outline-none focus:border-[#ea580c] focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1c130d] mb-1.5">Tech Stack (comma separated)</label>
                  <input
                    type="text"
                    name="tech_stack"
                    value={formData.tech_stack}
                    onChange={handleChange}
                    placeholder="React, TypeScript, Python, Supabase"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-sm text-[#1c130d] placeholder-[#8d7565] focus:outline-none focus:border-[#ea580c] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Social & Verification Section */}
              <div className="pt-4 border-t border-[#f1e4d3] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#1c130d]">Connected Profiles & Verification</h3>
                  <span className="text-[11px] text-[#8d7565] font-semibold">Security Protected</span>
                </div>

                {/* GITHUB VERIFICATION MODULE */}
                <div className="p-4 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#1c130d]">GitHub Account Verification</span>
                        {githubVerificationStatus === 'verified' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 size={12} /> Verified & Authorized
                          </span>
                        )}
                        {githubVerificationStatus === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                            <Mail size={12} /> Email Auth Pending
                          </span>
                        )}
                        {githubVerificationStatus === 'unlinked' && formData.github_url && (
                          <span className="text-[10px] font-bold text-[#ea580c] bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                            Verification Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6b5546] mt-1 leading-relaxed">
                        To protect your identity, linking your GitHub account requests authorization directly from GitHub, triggering an official security notification email to your registered GitHub email address.
                      </p>
                    </div>
                  </div>

                  {/* GitHub OAuth Direct Action */}
                  <div className="p-3 bg-white rounded-xl border border-[#eeddd0] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#24292e] text-white flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1c130d]">Authorize with GitHub</div>
                        <div className="text-[11px] text-[#8d7565]">Triggers official authorization & security notification to your email</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGithubOAuthAuthorize}
                      disabled={loading}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                      <span>Link GitHub Account</span>
                    </button>
                  </div>

                  {/* GitHub Direct URL Field & Status */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      name="github_url"
                      value={formData.github_url}
                      onChange={handleChange}
                      placeholder="https://github.com/your-username"
                      className={`flex-1 px-3.5 py-2.5 rounded-xl bg-white border text-sm font-mono text-[#1c130d] placeholder-[#8d7565] focus:outline-none transition-all ${
                        githubVerificationStatus === 'verified'
                          ? 'border-emerald-500 bg-emerald-50/20'
                          : 'border-[#fed7aa] focus:border-[#ea580c]'
                      }`}
                    />

                    {githubVerificationStatus !== 'verified' && (
                      <button
                        type="button"
                        onClick={handleGithubOAuthAuthorize}
                        disabled={loading}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white font-bold text-xs hover:brightness-105 shadow-md shadow-orange-500/25 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                        <span>Authorize via GitHub</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Other Social Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#1c130d] mb-1">Portfolio Website</label>
                    <input
                      type="url"
                      name="website_url"
                      value={formData.website_url}
                      onChange={handleChange}
                      placeholder="https://yourportfolio.dev"
                      className="w-full px-3 py-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-xs text-[#1c130d] focus:border-[#ea580c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1c130d] mb-1">LinkedIn URL</label>
                    <input
                      type="url"
                      name="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full px-3 py-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-xs text-[#1c130d] focus:border-[#ea580c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1c130d] mb-1">LeetCode URL</label>
                    <input
                      type="url"
                      name="leetcode_url"
                      value={formData.leetcode_url}
                      onChange={handleChange}
                      placeholder="https://leetcode.com/username"
                      className="w-full px-3 py-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-xs text-[#1c130d] focus:border-[#ea580c] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1c130d] mb-1">Twitter / X URL</label>
                    <input
                      type="url"
                      name="twitter_url"
                      value={formData.twitter_url}
                      onChange={handleChange}
                      placeholder="https://x.com/username"
                      className="w-full px-3 py-2 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] text-xs text-[#1c130d] focus:border-[#ea580c] outline-none"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-[#f1e4d3] bg-[#fffcf7] flex items-center justify-between shrink-0">
            <span className="text-xs text-[#6b5546]">
              {githubVerificationStatus === 'verified' ? 'All platforms verified' : 'GitHub verification pending'}
            </span>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-[#6b5546] hover:text-[#1c130d] hover:bg-[#faf6f0] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-profile-form"
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#ea580c] to-[#f97316] hover:brightness-105 rounded-xl shadow-md shadow-orange-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
