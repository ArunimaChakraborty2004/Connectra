import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertCircle, Sparkles, Wand2, Shield, Rocket, Briefcase, RefreshCw } from 'lucide-react';
import { toast } from '../../lib/toast';
import { generateBioOptions } from '../../lib/ai';

export default function EditProfileModal({ isOpen, onClose, profile, onUpdate }) {
  const [formData, setFormData] = useState({
    bio: profile?.bio || '',
    location: profile?.location || '',
    website_url: profile?.website_url || profile?.website || '',
    github_url: profile?.github_url || '',
    linkedin_url: profile?.linkedin_url || '',
    twitter_url: profile?.twitter_url || '',
    leetcode_url: profile?.leetcode_url || '',
    tech_stack: profile?.tech_stack || '',
  });
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [githubLinked, setGithubLinked] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

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
    } catch (err) {
      toast.error('Failed to generate AI bios');
    } finally {
      setAiBioLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Only check the original profile URL when opening the modal
    if (profile?.github_url && profile.github_url.includes('github.com/')) {
       setGithubLinked(true);
    } else {
       setGithubLinked(false);
    }
  }, [isOpen, profile?.github_url]);

  const handleLinkGithub = async () => {
    if (!formData.github_url || !formData.github_url.includes('github.com/')) {
      toast.error("Please enter a valid GitHub URL first.");
      return;
    }
    setLoading(true);
    // Mock sending verification email
    setTimeout(() => {
      setLoading(false);
      setVerificationSent(true);
      toast.success("Verification email sent! Check your inbox.");
    }, 1500);
  };

  const handleResendMail = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Verification email resent!");
    }, 1000);
  };

  const handleMockVerify = () => {
    setGithubLinked(true);
    setVerificationSent(false);
    toast.success("GitHub URL verified successfully!");
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'github_url') {
      setGithubLinked(false);
      setVerificationSent(false);
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
    
    if (formData.github_url && !githubLinked) {
      toast.error("Please verify your GitHub URL before saving.");
      return;
    }

    setLoading(true);

    let avatar_url = profile.avatar_url;

    if (avatarFile) {
      // 1. Try uploading to Supabase Storage bucket 'avatars'
      try {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatar_url = publicUrlData.publicUrl;
        } else {
          // If storage bucket doesn't exist or errors, convert to compressed base64 Data URL
          console.warn('Storage bucket upload failed, using Data URL fallback:', uploadError.message);
          avatar_url = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_DIM = 256;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                  if (width > MAX_DIM) {
                    height *= MAX_DIM / width;
                    width = MAX_DIM;
                  }
                } else {
                  if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
              };
              img.src = e.target.result;
            };
            reader.readAsDataURL(avatarFile);
          });
        }
      } catch (err) {
        console.warn('Avatar process fallback:', err);
      }
    }

    // Base payload with columns guaranteed to exist in the database
    const updatePayload = {
      bio: formData.bio,
      tech_stack: formData.tech_stack,
      website_url: formData.website_url,
      linkedin_url: formData.linkedin_url,
      github_url: formData.github_url,
      avatar_url,
    };

    // If extra columns (location, leetcode_url, twitter_url) exist in Supabase, include them; otherwise fallback safely
    let { data, error } = await supabase
      .from('profiles')
      .update({
        ...updatePayload,
        ...(formData.location ? { location: formData.location } : {}),
        ...(formData.twitter_url ? { twitter_url: formData.twitter_url } : {}),
        ...(formData.leetcode_url ? { leetcode_url: formData.leetcode_url } : {}),
      })
      .eq('id', profile.id)
      .select()
      .single();

    // If schema error occurred due to missing optional columns (e.g. leetcode_url or location column missing in Postgres)
    if (error && (error.message?.includes('leetcode_url') || error.message?.includes('location') || error.message?.includes('twitter_url') || error.code === 'PGRST204')) {
      console.warn('Optional columns missing in schema, retrying with core columns:', error.message);
      const retryResult = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated successfully');
      onUpdate(data);
      onClose();
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-surface border border-border w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-border">
            <h2 className="text-xl font-bold text-main">Edit Profile</h2>
            <button onClick={onClose} className="text-muted hover:text-main transition-colors cursor-pointer">
              <X size={22} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              
              {/* Avatar Upload */}
              <div className="flex items-center gap-6">
                <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-background border border-white/10 shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload size={20} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-semibold">Upload</span>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-main mb-1">Profile Picture</h3>
                  <p className="text-xs text-muted mb-3">Upload a new avatar (JPG, PNG, max 2MB).</p>
                </div>
              </div>

              {/* Bio & Details */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-semibold text-main">Bio</label>
                    <button
                      type="button"
                      onClick={handleGenerateAiBios}
                      disabled={aiBioLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-orange-50 text-[#ea580c] border border-orange-200 hover:bg-orange-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {aiBioLoading ? (
                        <RefreshCw size={12} className="animate-spin text-[#ea580c]" />
                      ) : (
                        <Sparkles size={12} className="text-[#ea580c]" />
                      )}
                      <span>{aiBioLoading ? 'Generating...' : '✨ AI Bio Crafter (Groq)'}</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {showAiBioPanel && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-4 rounded-xl bg-[#faf6f0] border border-[#f1e4d3] flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between pb-1 border-b border-[#f1e4d3]">
                          <span className="text-xs font-bold text-[#2b1f17] flex items-center gap-1.5">
                            <Wand2 size={13} className="text-[#ea580c]" /> AI Suggested Bios
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAiBioPanel(false)}
                            className="text-xs text-[#8d7565] hover:text-[#2b1f17] cursor-pointer"
                          >
                            Close
                          </button>
                        </div>

                        {aiBioLoading ? (
                          <div className="flex flex-col gap-2 py-3">
                            <div className="flex items-center gap-2 text-xs text-[#ea580c] font-medium">
                              <RefreshCw size={12} className="animate-spin" />
                              Llama 3 is crafting tailored bios based on your tech stack...
                            </div>
                            <div className="h-3 bg-orange-200/50 rounded animate-pulse w-5/6"></div>
                            <div className="h-3 bg-orange-200/50 rounded animate-pulse w-3/5"></div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            {aiBioSuggestions?.map((item, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-lg bg-white border border-[#f1e4d3] hover:border-orange-300 transition-colors flex flex-col gap-2 text-left shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-[#2b1f17] uppercase tracking-wider flex items-center gap-1.5">
                                    {idx === 0 && <Briefcase size={12} className="text-[#ea580c]" />}
                                    {idx === 1 && <Rocket size={12} className="text-[#ea580c]" />}
                                    {idx === 2 && <Shield size={12} className="text-[#ea580c]" />}
                                    {item.style}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, bio: item.bio }));
                                      toast.success(`Applied ${item.style} bio!`);
                                    }}
                                    className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#ea580c] text-white hover:bg-[#c2410c] transition-all cursor-pointer shadow-xs"
                                  >
                                    Use this
                                  </button>
                                </div>
                                <p className="text-xs text-[#6b5546] leading-relaxed select-text">
                                  {item.bio}
                                </p>
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
                    placeholder="Tell the community about yourself..."
                    className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors min-h-[100px] resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-main mb-1">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-main mb-1">Tech Stack (comma separated)</label>
                    <input
                      type="text"
                      name="tech_stack"
                      value={formData.tech_stack}
                      onChange={handleChange}
                      placeholder="e.g. React, Node.js, Python"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-bold text-main mb-4">Social & Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Portfolio Website</label>
                    <input
                      type="url"
                      name="website_url"
                      value={formData.website_url}
                      onChange={handleChange}
                      placeholder="https://yourwebsite.com"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1 flex justify-between">
                      GitHub URL
                      {!githubLinked && <span className="text-primary text-[10px]">Verification Required</span>}
                    </label>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2">
                        <input
                          type="url"
                          name="github_url"
                          value={formData.github_url}
                          onChange={handleChange}
                          placeholder="https://github.com/username"
                          className={`w-full bg-background border ${githubLinked ? 'border-emerald-500/50' : 'border-white/10'} rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors`}
                        />
                        {!githubLinked && !verificationSent && formData.github_url.length > 0 && (
                          <button 
                            type="button" 
                            onClick={handleLinkGithub} 
                            disabled={loading}
                            className="w-full py-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-bold rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
                          >
                            Verify with Email
                          </button>
                        )}
                        {githubLinked && (
                          <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1 whitespace-nowrap">
                            <CheckCircle2 size={14} /> Verified
                          </div>
                        )}
                      </div>
                      
                      {verificationSent && !githubLinked && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col gap-2 text-sm text-blue-400 mt-1">
                          <p>A verification link has been sent to your registered email address.</p>
                          <div className="flex items-center gap-3 mt-1">
                             <button type="button" onClick={handleResendMail} disabled={loading} className="text-xs font-bold text-blue-300 hover:text-white transition-colors underline">
                               Resend Mail
                             </button>
                             <span className="text-blue-500/50">|</span>
                             <button type="button" onClick={handleMockVerify} className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
                               (Test) Simulate Click
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">LinkedIn URL</label>
                    <input
                      type="url"
                      name="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={handleChange}
                      placeholder="https://linkedin.com/in/username"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">LeetCode URL</label>
                    <input
                      type="url"
                      name="leetcode_url"
                      value={formData.leetcode_url}
                      onChange={handleChange}
                      placeholder="https://leetcode.com/username"
                      className="w-full bg-background border border-white/10 rounded-xl p-3 text-sm text-main focus:border-primary/50 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="p-5 border-t border-border flex justify-end gap-3 bg-surface shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-main hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
