import { useState } from 'react';
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
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
            <label className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-1.5 block">GitHub Profile</label>
            <input 
              type="url" 
              value={githubUrl} 
              onChange={e => setGithubUrl(e.target.value)} 
              placeholder="https://github.com/..." 
              className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-main focus:border-primary/50 outline-none transition-colors"
            />
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
