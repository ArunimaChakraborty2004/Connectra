import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '../../lib/toast';

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

  useEffect(() => {
    if (!isOpen) return;
    const checkLinkedAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const gitIdentity = user.identities?.find(i => i.provider === 'github');
      if (gitIdentity) {
        setGithubLinked(true);
        const username = gitIdentity.identity_data.user_name || gitIdentity.identity_data.preferred_username;
        if (username && !formData.github_url) {
           setFormData(prev => ({ ...prev, github_url: `https://github.com/${username}` }));
        }
      }
    };
    checkLinkedAccounts();
  }, [isOpen]);

  const handleLinkGithub = async () => {
    toast.success("Redirecting to GitHub for verification...");
    const { error } = await supabase.auth.linkIdentity({ 
      provider: 'github', 
      options: { redirectTo: window.location.href }
    });
    if (error) toast.error(error.message);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    setLoading(true);

    let avatar_url = profile.avatar_url;

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile);

      if (uploadError) {
        toast.error('Error uploading avatar');
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatar_url = publicUrlData.publicUrl;
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...formData,
        avatar_url,
      })
      .eq('id', profile.id)
      .select()
      .single();

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
          className="bg-surface border border-white/10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-main">Edit Profile</h2>
            <button onClick={onClose} className="text-muted hover:text-main transition-colors">
              <X size={24} />
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
                  <label className="block text-sm font-medium text-main mb-1">Bio</label>
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
                    {githubLinked ? (
                      <div className="flex items-center justify-between bg-surface border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-400">
                         <span className="truncate max-w-[150px]">{formData.github_url || 'Linked'}</span>
                         <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider shrink-0"><CheckCircle2 size={14}/> Verified</div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="url"
                          name="github_url"
                          value={formData.github_url}
                          disabled
                          placeholder="Verify to link"
                          className="flex-1 w-full bg-background/50 border border-white/10 rounded-xl p-3 text-sm text-gray-500 cursor-not-allowed outline-none"
                        />
                        <button 
                          type="button" 
                          onClick={handleLinkGithub} 
                          className="px-4 bg-white text-black text-xs font-bold rounded-xl hover:bg-[#e5e5e5] transition-colors whitespace-nowrap"
                        >
                          Verify Link
                        </button>
                      </div>
                    )}
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

          <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-surface shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-main hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
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
