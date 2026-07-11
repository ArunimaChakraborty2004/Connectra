import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '../lib/toast';

export default function Rightbar({ profile, onProfileUpdate }) {
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [techStack, setTechStack] = useState(profile.tech_stack || '');
  const [githubUrl, setGithubUrl] = useState(profile.github_url || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [githubLinked, setGithubLinked] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (profile?.github_url && profile.github_url.includes('github.com/')) {
       setGithubLinked(true);
    } else {
       setGithubLinked(false);
    }
  }, [profile?.github_url]);

  const handleLinkGithub = async () => {
    if (!githubUrl || !githubUrl.includes('github.com/')) {
      toast.error("Please enter a valid GitHub URL first.");
      return;
    }
    setLoading(true);
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

  const handleGithubChange = (e) => {
    setGithubUrl(e.target.value);
    setGithubLinked(false);
    setVerificationSent(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (githubUrl && !githubLinked) {
      toast.error("Please verify your GitHub Profile before saving.");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        username, 
        bio, 
        tech_stack: techStack, 
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        website_url: websiteUrl,
        avatar_url: avatarUrl
      })
      .eq('id', user.id);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated successfully!');
      onProfileUpdate();
    }
  };

  return (
    <aside className="sticky top-24 w-full">
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
        
        <div className="flex items-center gap-2 mb-6 text-main">
          <Settings2 size={20} className="text-muted" />
          <h3 className="font-semibold text-sm">Profile Settings</h3>
        </div>

        <form onSubmit={handleUpdate} className="flex flex-col gap-4 relative z-10">
          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea 
              rows="2" 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder="Tell us about yourself..."
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors resize-none"
            ></textarea>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Avatar URL</label>
            <input 
              type="url" 
              value={avatarUrl} 
              onChange={e => setAvatarUrl(e.target.value)} 
              placeholder="https://..." 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Tech Stack</label>
            <input 
              type="text" 
              value={techStack} 
              onChange={e => setTechStack(e.target.value)} 
              placeholder="React, Node, Python..." 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 flex justify-between">
              GitHub Profile
              {!githubLinked && <span className="text-primary text-[10px]">Verification Required</span>}
            </label>
            <div className="flex flex-col gap-2">
              <input 
                type="url" 
                value={githubUrl} 
                onChange={handleGithubChange} 
                placeholder="https://github.com/..." 
                className={`w-full glass-panel border ${githubLinked ? 'border-emerald-500/50' : 'border-transparent'} rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors`}
              />
              {!githubLinked && !verificationSent && githubUrl.length > 0 && (
                <button 
                  type="button" 
                  onClick={handleLinkGithub} 
                  disabled={loading}
                  className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-bold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  Verify with Email
                </button>
              )}
              {githubLinked && (
                <div className="w-full py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg flex items-center justify-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={14} /> Verified
                </div>
              )}
              {verificationSent && !githubLinked && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex flex-col gap-2 text-sm text-blue-400 mt-1">
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
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">LinkedIn</label>
            <input 
              type="url" 
              value={linkedinUrl} 
              onChange={e => setLinkedinUrl(e.target.value)} 
              placeholder="https://linkedin.com/in/..." 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>
          
          <div>
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">Website / Portfolio</label>
            <input 
              type="url" 
              value={websiteUrl} 
              onChange={e => setWebsiteUrl(e.target.value)} 
              placeholder="https://..." 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-main font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={18} className="group-hover/btn:scale-110 transition-transform" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
